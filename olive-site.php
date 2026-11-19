<?php
/**
 * Plugin Name:       OLIVE Site
 * Plugin URI:        https://github.com/masthan85/olivemineralwater
 * Description:       Layout fixes and redirects for the OLIVE Pure Mineral Water website.
 * Version:           1.0.5
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * Author:            OLIVE Pure Mineral Water
 * License:           GPL-2.0-or-later
 * Text Domain:       olive-site
 *
 * @package OliveSite
 */

defined( 'ABSPATH' ) || exit;

const OLIVE_SITE_VERSION = '1.0.5';

/**
 * Stylesheets.
 *
 * site-fixes.css loads on every page and about.css on the About page. shop.css
 * styles the WooCommerce pages, so it loads only while WooCommerce is active.
 */
function olive_site_enqueue_styles(): void {
	$base = plugin_dir_url( __FILE__ ) . 'assets/css/';

	wp_enqueue_style( 'olive-site-fixes', $base . 'site-fixes.css', array(), OLIVE_SITE_VERSION );

	if ( is_page( 'about' ) ) {
		wp_enqueue_style( 'olive-about', $base . 'about.css', array( 'olive-site-fixes' ), OLIVE_SITE_VERSION );
	}

	if ( class_exists( 'WooCommerce' ) ) {
		wp_enqueue_style( 'olive-shop', $base . 'shop.css', array( 'olive-site-fixes' ), OLIVE_SITE_VERSION );
	}
}
add_action( 'wp_enqueue_scripts', 'olive_site_enqueue_styles', 20 );

/**
 * Where an old or duplicate address should send the visitor, or null to leave it alone.
 *
 * Covers the .html addresses of the previous site and the duplicate pages the
 * site import created from links with query strings (order-query-1 and so on).
 *
 * @param string $path Request path, such as "/products.html".
 * @return string|null Site-relative target such as "/products/", or null.
 */
function olive_site_redirect_target( string $path ): ?string {
	$path = strtolower( trim( $path, '/' ) );

	if ( '' === $path ) {
		return null;
	}

	// With WooCommerce, customer accounts live on its My Account page.
	$account = class_exists( 'WooCommerce' ) ? '/my-account/' : '/account/';

	if ( preg_match( '/^order-query-\d+$/', $path ) ) {
		return '/order/';
	}

	if ( preg_match( '/^account-query-\d+$/', $path ) || 'account.html' === $path ) {
		return $account;
	}

	if ( 'account' === $path && '/my-account/' === $account ) {
		return $account;
	}

	$old_pages = array(
		'index.html'         => '/',
		'products.html'      => '/products/',
		'order.html'         => '/order/',
		'trade-enquiry.html' => '/trade-enquiry/',
		'about.html'         => '/about/',
		'delivery.html'      => '/delivery/',
		'track.html'         => '/track/',
		'login.html'         => '/login/',
		'operations.html'    => '/login/',
	);

	if ( isset( $old_pages[ $path ] ) ) {
		return $old_pages[ $path ];
	}

	if ( preg_match( '/^ops-[a-z-]+\.html$/', $path ) ) {
		return '/login/';
	}

	return null;
}

/**
 * Sends old and duplicate addresses to the right page with a permanent redirect.
 *
 * Runs before WordPress's own canonical redirect so the mapping above always wins.
 */
function olive_site_redirect_old_addresses(): void {
	if ( ! isset( $_SERVER['REQUEST_URI'] ) ) {
		return;
	}

	$path = wp_parse_url( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ), PHP_URL_PATH );

	if ( ! is_string( $path ) ) {
		return;
	}

	$target = olive_site_redirect_target( $path );

	if ( null !== $target ) {
		wp_safe_redirect( home_url( $target ), 301, 'OLIVE Site' );
		exit;
	}
}
add_action( 'template_redirect', 'olive_site_redirect_old_addresses', 1 );

/**
 * [olive_social_login]: the "Continue with Google" buttons on the My Account page.
 *
 * Shows Nextend Social Login's buttons to signed-out visitors once at least one
 * provider is set up in Nextend, and nothing before then, so the page never shows
 * a raw shortcode.
 */
function olive_site_social_login_shortcode(): string {
	if ( is_user_logged_in() || ! shortcode_exists( 'nextend_social_login' ) ) {
		return '';
	}

	return do_shortcode( '[nextend_social_login]' );
}
add_shortcode( 'olive_social_login', 'olive_site_social_login_shortcode' );
