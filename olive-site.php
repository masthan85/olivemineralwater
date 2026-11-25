<?php
/**
 * Plugin Name:       OLIVE Site
 * Plugin URI:        https://github.com/masthan85/olivemineralwater
 * Description:       Layout fixes and redirects for the OLIVE Pure Mineral Water website.
 * Version:           1.2.5
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * Author:            OLIVE Pure Mineral Water
 * License:           GPL-2.0-or-later
 * Text Domain:       olive-site
 *
 * @package OliveSite
 */

defined( 'ABSPATH' ) || exit;

const OLIVE_SITE_VERSION = '1.2.5';
require_once __DIR__ . '/includes/order-requests.php';
require_once __DIR__ . '/includes/form-emails.php';

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

	$is_account = function_exists( 'is_account_page' ) && is_account_page();
	if ( $is_account || is_page( 'login' ) ) {
		wp_enqueue_style( 'olive-account', $base . 'account.css', array( 'olive-site-fixes' ), OLIVE_SITE_VERSION );
	}
}
add_action( 'wp_enqueue_scripts', 'olive_site_enqueue_styles', 20 );

/**
 * Customer accounts.
 *
 * Shows "Create an account" beside "Sign in" on My Account, whatever the
 * WooCommerce setting says. WooCommerce makes the username and emails a link
 * to set the password, so customers only type their email address.
 */
add_filter( 'pre_option_woocommerce_enable_myaccount_registration', fn() => 'yes' );
add_filter( 'pre_option_woocommerce_registration_generate_username', fn() => 'yes' );
add_filter( 'pre_option_woocommerce_registration_generate_password', fn() => 'yes' );

/**
 * Plainer wording on the My Account sign-in and register forms.
 */
function olive_site_account_wording( string $translation, string $text, string $domain ): string {
	if ( 'woocommerce' !== $domain || ! function_exists( 'is_account_page' ) || ! is_account_page() || is_user_logged_in() ) {
		return $translation;
	}

	$words = array(
		'Login'                  => 'Sign in',
		'Log in'                 => 'Sign in',
		'Register'               => 'Create an account',
		'Username or email address' => 'Email address',
	);

	return $words[ $text ] ?? $translation;
}
add_filter( 'gettext', 'olive_site_account_wording', 20, 3 );

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

/**
 * App support: lets phones install the site as the OLIVE app, and lets the
 * Google Play version open the site full screen.
 *
 * - /?olive_sw=1 serves the service worker from the site root, so it can control every page.
 * - /?olive_offline=1 serves the page shown when there is no connection.
 * - /.well-known/assetlinks.json proves to Android that the Google Play app belongs to
 *   this site. assets/pwa/assetlinks.json holds the app's signing fingerprint.
 */
function olive_site_serve_app_files(): void {
	$dir = plugin_dir_path( __FILE__ ) . 'assets/pwa/';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only public files.
	$query = $_GET;
	$path  = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ), PHP_URL_PATH ) : '';

	$files = array();
	if ( isset( $query['olive_sw'] ) ) {
		$files = array( 'sw.js', 'application/javascript; charset=utf-8', array( 'Service-Worker-Allowed: /' ) );
	} elseif ( isset( $query['olive_offline'] ) ) {
		$files = array( 'offline.html', 'text/html; charset=utf-8', array() );
	} elseif ( '/.well-known/assetlinks.json' === $path ) {
		$files = array( 'assetlinks.json', 'application/json', array( 'Access-Control-Allow-Origin: *' ) );
	}

	if ( ! $files ) {
		return;
	}

	list( $file, $type, $extra ) = $files;
	status_header( 200 );
	header( 'Content-Type: ' . $type );
	header( 'Cache-Control: no-cache' );
	header( 'X-Content-Type-Options: nosniff' );
	foreach ( $extra as $line ) {
		header( $line );
	}
	readfile( $dir . $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
	exit;
}
add_action( 'init', 'olive_site_serve_app_files', 1 );

/**
 * Tells browsers about the app: manifest, colours and home-screen icons.
 */
function olive_site_app_head(): void {
	$base = plugin_dir_url( __FILE__ ) . 'assets/pwa/';
	printf( '<link rel="manifest" href="%s">' . "\n", esc_url( $base . 'manifest.json?ver=' . OLIVE_SITE_VERSION ) );
	echo '<meta name="theme-color" content="#184232">' . "\n";
	echo '<meta name="mobile-web-app-capable" content="yes">' . "\n";
	echo '<meta name="apple-mobile-web-app-capable" content="yes">' . "\n";
	echo '<meta name="apple-mobile-web-app-title" content="OLIVE">' . "\n";
	echo '<meta name="apple-mobile-web-app-status-bar-style" content="default">' . "\n";
	printf( '<link rel="apple-touch-icon" href="%s">' . "\n", esc_url( $base . 'apple-touch-icon.png' ) );
}
add_action( 'wp_head', 'olive_site_app_head', 2 );

/**
 * Registers the service worker once the page has loaded.
 */
function olive_site_register_service_worker(): void {
	if ( is_admin() ) {
		return;
	}
	?>
	<script>
	if ('serviceWorker' in navigator) {
		window.addEventListener('load', function () {
			navigator.serviceWorker.register('/?olive_sw=1', { scope: '/' }).catch(function () {});
		});
	}
	</script>
	<?php
}
add_action( 'wp_footer', 'olive_site_register_service_worker', 99 );

/**
 * Link previews.
 *
 * Adds Open Graph and Twitter card tags so a link shared on WhatsApp,
 * Facebook, LinkedIn or X shows the page title and the bottle photo.
 * Skipped when Jetpack already prints its own Open Graph tags.
 */
function olive_site_link_preview_tags(): void {
	if ( has_action( 'wp_head', 'jetpack_og_tags' ) ) {
		return;
	}

	$image = home_url( '/wp-content/uploads/2026/11/olive-emerald-green-750ml-330ml-hd2.jpg' );
	if ( is_singular() && has_post_thumbnail() ) {
		$image = (string) get_the_post_thumbnail_url( null, 'large' );
	}

	$url  = is_singular() ? (string) get_permalink() : home_url( '/' );
	$tags = array(
		'og:type'      => is_front_page() ? 'website' : 'article',
		'og:site_name' => get_bloginfo( 'name' ),
		'og:title'     => wp_get_document_title(),
		'og:url'       => $url,
		'og:image'     => $image,
		'og:locale'    => 'en_GB',
	);

	foreach ( $tags as $property => $content ) {
		printf( '<meta property="%s" content="%s">' . "\n", esc_attr( $property ), esc_attr( $content ) );
	}
	echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
}
add_action( 'wp_head', 'olive_site_link_preview_tags', 5 );
