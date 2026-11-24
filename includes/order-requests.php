<?php
/**
 * Order requests become WooCommerce orders.
 *
 * The Order page (page 21) uses a Jetpack form. Jetpack still saves each
 * request under Jetpack → Forms and emails it as before. This file also
 * creates a WooCommerce order from it, so the team can track every request
 * in WooCommerce → Orders: status, notes, history and the customer's details.
 *
 * Each order starts "On hold", meaning "the team has not confirmed it yet".
 * WooCommerce emails its usual "New order" message to the shop's address.
 * The customer gets no WooCommerce email at this point, because nothing has
 * been agreed or paid. The team confirms the price and delivery day first.
 *
 * @package OliveSite
 */

defined( 'ABSPATH' ) || exit;

/** Page that holds the order request form. */
const OLIVE_ORDER_FORM_PAGE = 21;

/** Marks orders made by this file (WooCommerce shows it as the order's origin). */
const OLIVE_ORDER_CREATED_VIA = 'olive-order-form';

/**
 * Creates the order after Jetpack has saved the form entry.
 *
 * @param int   $feedback_id Jetpack's entry ID.
 * @param array $fields      The form's field objects.
 * @param bool  $is_spam     Whether Akismet marked the entry as spam.
 */
function olive_site_order_from_request( $feedback_id, $fields, $is_spam ): void {
	if ( $is_spam || ! function_exists( 'wc_create_order' ) || ! is_array( $fields ) ) {
		return;
	}
	if ( olive_site_request_page( (int) $feedback_id ) !== OLIVE_ORDER_FORM_PAGE ) {
		return;
	}
	if ( get_post_meta( (int) $feedback_id, '_olive_order_id', true ) ) {
		return;
	}

	try {
		$values = olive_site_request_values( $fields );
		$email  = sanitize_email( $values['email'] ?? '' );
		if ( ! is_email( $email ) ) {
			return;
		}

		$order = wc_create_order( array( 'created_via' => OLIVE_ORDER_CREATED_VIA ) );
		if ( is_wp_error( $order ) ) {
			return;
		}

		list( $first, $last ) = olive_site_split_name( $values['name'] ?? '' );
		$address  = sanitize_text_field( $values['delivery address'] ?? '' );
		$postcode = strtoupper( sanitize_text_field( $values['delivery postcode'] ?? '' ) );
		$phone    = sanitize_text_field( $values['phone (optional)'] ?? $values['phone'] ?? '' );
		$wanted   = sanitize_textarea_field( $values['what would you like?'] ?? '' );

		$order->set_billing_first_name( $first );
		$order->set_billing_last_name( $last );
		$order->set_billing_email( $email );
		$order->set_billing_phone( $phone );
		$order->set_billing_address_1( $address );
		$order->set_billing_postcode( $postcode );
		$order->set_billing_country( 'GB' );
		$order->set_shipping_first_name( $first );
		$order->set_shipping_last_name( $last );
		$order->set_shipping_address_1( $address );
		$order->set_shipping_postcode( $postcode );
		$order->set_shipping_country( 'GB' );
		$order->set_customer_note( $wanted );

		$customer = get_user_by( 'email', $email );
		if ( $customer ) {
			$order->set_customer_id( $customer->ID );
		}

		$added = olive_site_add_requested_bottles( $order, $wanted );

		$order->update_meta_data( '_olive_feedback_id', (int) $feedback_id );
		if ( ! empty( $values['kind'] ) ) {
			$order->update_meta_data( '_olive_request_kind', sanitize_text_field( $values['kind'] ) );
		}
		$order->calculate_totals( false );
		$order->save();

		$order->add_order_note(
			sprintf(
				/* translators: 1: Jetpack entry ID, 2: what the bottles line says. */
				"Order request from the website's Order page (Jetpack form entry %1\$d).\n%2\$s\nConfirm availability, the price and a delivery day with the customer, then set the prices and change the status to Processing.",
				(int) $feedback_id,
				$added ? 'Bottles that matched the shop products were added; check them against the customer\'s note.' : 'No bottles could be matched to shop products, so add them from the customer\'s note.'
			)
		);
		$order->update_status( 'on-hold', 'Waiting for the team to confirm.' );

		update_post_meta( (int) $feedback_id, '_olive_order_id', $order->get_id() );
	} catch ( \Throwable $e ) {
		// Never stop the form from working; Jetpack has already saved the request.
		error_log( 'OLIVE Site: could not create an order from form entry ' . (int) $feedback_id . ': ' . $e->getMessage() );
	}
}
add_action( 'grunion_after_feedback_post_inserted', 'olive_site_order_from_request', 10, 3 );

/**
 * The page a form entry came from.
 */
function olive_site_request_page( int $feedback_id ): int {
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Jetpack has already checked the submission.
	if ( isset( $_POST['contact-form-id'] ) ) {
		return (int) sanitize_text_field( wp_unslash( $_POST['contact-form-id'] ) );
	}
	$source = (int) get_post_meta( $feedback_id, '_feedback_source_post_id', true );
	return $source ? $source : (int) wp_get_post_parent_id( $feedback_id );
}

/**
 * The submitted values, keyed by the field label in lower case.
 *
 * @param array $fields Jetpack field objects.
 * @return array<string, string>
 */
function olive_site_request_values( array $fields ): array {
	$values = array();
	foreach ( $fields as $id => $field ) {
		$label = is_object( $field ) && method_exists( $field, 'get_attribute' ) ? (string) $field->get_attribute( 'label' ) : (string) $id;
		$value = is_object( $field ) && isset( $field->value ) ? $field->value : '';
		if ( is_array( $value ) ) {
			$value = implode( ', ', $value );
		}
		$values[ strtolower( trim( $label ) ) ] = trim( (string) $value );
	}
	return $values;
}

/**
 * Splits "Jo Bloggs Smith" into "Jo" and "Bloggs Smith".
 *
 * @return array{0: string, 1: string}
 */
function olive_site_split_name( string $name ): array {
	$parts = preg_split( '/\s+/', trim( sanitize_text_field( $name ) ), 2 );
	return array( $parts[0] ?? '', $parts[1] ?? '' );
}

/**
 * Adds the bottles the customer asked for, where the request is clear.
 *
 * A line such as "12 × Classic Olive Green (750ml)" adds 12 of that product.
 * A part is added only when the quantity, the label and the size all match one
 * shop product; anything else stays in the customer's note for the team.
 *
 * @return int How many lines were added.
 */
function olive_site_add_requested_bottles( \WC_Order $order, string $wanted ): int {
	$products = wc_get_products(
		array(
			'status' => array( 'publish', 'draft', 'private' ),
			'limit'  => 50,
		)
	);

	$catalogue = array();
	foreach ( $products as $product ) {
		$name = olive_site_simplify( $product->get_name() );
		if ( ! preg_match( '/(\d+)\s*ml/', $name, $size ) ) {
			continue;
		}
		$label       = trim( preg_replace( '/\(?\d+\s*ml\)?/', '', $name ) );
		$catalogue[] = array( $product, $label, $size[1] );
	}

	$added = 0;
	foreach ( preg_split( '/[\n,;]+|\band\b/i', $wanted ) as $part ) {
		$part = olive_site_simplify( $part );
		if ( ! preg_match( '/^\D*?(\d+)\s*(?:x|×|\*)?\s*(.+)$/u', $part, $m ) ) {
			continue;
		}
		$quantity = (int) $m[1];
		$rest     = $m[2];
		if ( $quantity < 1 || $quantity > 10000 || ! preg_match( '/(\d+)\s*ml/', $rest, $size ) ) {
			continue;
		}

		// Score each product of that size by how many words of its label appear,
		// so "Forest Reserve" finds "Dark Green - Forest Reserve". At least two
		// words must match, and one product must score higher than the rest.
		$words  = preg_split( '/[^a-z]+/', $rest, -1, PREG_SPLIT_NO_EMPTY );
		$scores = array();
		foreach ( $catalogue as $i => $item ) {
			if ( $item[2] !== $size[1] ) {
				continue;
			}
			$label_words  = preg_split( '/[^a-z]+/', $item[1], -1, PREG_SPLIT_NO_EMPTY );
			$scores[ $i ] = count( array_intersect( array_unique( $label_words ), $words ) );
		}
		arsort( $scores );
		$best = array_slice( $scores, 0, 2, true );
		$top  = (int) reset( $best );
		if ( $top >= 2 && ( count( $best ) < 2 || $top > (int) next( $best ) ) ) {
			$order->add_product( $catalogue[ (int) array_key_first( $best ) ][0], $quantity );
			++$added;
		}
	}
	return $added;
}

/**
 * Lower case, plain hyphens and single spaces, for matching product names.
 */
function olive_site_simplify( string $text ): string {
	$text = strtolower( html_entity_decode( $text, ENT_QUOTES, 'UTF-8' ) );
	$text = str_replace( array( '–', '—', '-' ), ' ', $text );
	return trim( preg_replace( '/\s+/', ' ', $text ) );
}

/**
 * No WooCommerce "on hold" email to the customer for a form request.
 *
 * WooCommerce's wording ("on hold until we confirm payment") does not fit a
 * request that has no price yet. The team replies to the customer instead.
 *
 * @param bool           $enabled Whether the email is on.
 * @param \WC_Order|null $order   The order.
 */
function olive_site_quiet_request_email( $enabled, $order ) {
	if ( $order instanceof \WC_Order && OLIVE_ORDER_CREATED_VIA === $order->get_created_via() ) {
		return false;
	}
	return $enabled;
}
add_filter( 'woocommerce_email_enabled_customer_on_hold_order', 'olive_site_quiet_request_email', 10, 2 );
