<?php
/**
 * Where the Order and Trade Enquiry form emails go.
 *
 * A Jetpack form with no recipient set emails the page's author, which on this
 * site is a personal address. Requests from these pages go to the shared
 * service mailbox instead.
 *
 * If someone sets a recipient in the form's own settings in the editor, that
 * address is used and this file changes nothing.
 *
 * @package OliveSite
 */

defined( 'ABSPATH' ) || exit;

/** The shared mailbox for customer requests. */
const OLIVE_SERVICE_EMAIL = 'service@olivemineralwater.co.uk';

/** Pages whose form emails go to the service mailbox: Order (21) and Trade Enquiry (28). */
const OLIVE_SERVICE_FORM_PAGES = array( 21, 28 );

/**
 * Sends the form email to the service mailbox.
 *
 * @param string[]|string $to Recipients Jetpack picked.
 * @return string[]|string
 */
function olive_site_form_recipient( $to ) {
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Jetpack has already checked the submission.
	$page = isset( $_POST['contact-form-id'] ) ? (int) sanitize_text_field( wp_unslash( $_POST['contact-form-id'] ) ) : 0;
	if ( ! in_array( $page, OLIVE_SERVICE_FORM_PAGES, true ) ) {
		return $to;
	}

	// Only replace Jetpack's fallback (the page author or the site admin),
	// never an address someone chose in the form's settings.
	$defaults = array( strtolower( (string) get_option( 'admin_email' ) ) );
	$author   = get_userdata( (int) get_post_field( 'post_author', $page ) );
	if ( $author ) {
		$defaults[] = strtolower( $author->user_email );
	}

	$current = array_map( 'strtolower', array_map( 'trim', (array) $to ) );
	if ( array() === array_diff( $current, $defaults ) ) {
		return array( OLIVE_SERVICE_EMAIL );
	}
	return $to;
}
add_filter( 'contact_form_to', 'olive_site_form_recipient' );
