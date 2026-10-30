<?php
/**
 * Settings → Cookie consent.
 */

defined( 'ABSPATH' ) || exit;

final class CCWP_Admin {

	const PAGE = 'cookie-consent';

	public static function init(): void {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( CCWP_FILE ), array( __CLASS__, 'action_link' ) );
	}

	public static function menu(): void {
		add_options_page(
			__( 'Cookie consent', 'cookie-consent' ),
			__( 'Cookie consent', 'cookie-consent' ),
			'manage_options',
			self::PAGE,
			array( __CLASS__, 'render' )
		);
	}

	public static function assets( string $hook ): void {
		if ( 'settings_page_' . self::PAGE !== $hook ) {
			return;
		}
		wp_enqueue_style( 'ccwp-admin', CCWP_URL . 'assets/admin.css', array(), CCWP_VERSION );
		wp_enqueue_style( 'wp-color-picker' );
		wp_enqueue_script( 'wp-color-picker' );
		wp_add_inline_script( 'wp-color-picker', 'jQuery(function($){$(".ccwp-color").wpColorPicker();});' );
	}

	/** @param string[] $links */
	public static function action_link( array $links ): array {
		$url = admin_url( 'options-general.php?page=' . self::PAGE );
		array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'cookie-consent' ) . '</a>' );
		return $links;
	}

	private static function field_name( string ...$path ): string {
		return CCWP_OPTION . '[' . implode( '][', $path ) . ']';
	}

	public static function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$o          = CCWP_Options::get();
		$cat_labels = array(
			'analytics' => array( __( 'Analytics', 'cookie-consent' ), __( 'Google Analytics, Tag Manager, Hotjar, Clarity, Matomo...', 'cookie-consent' ) ),
			'marketing' => array( __( 'Marketing', 'cookie-consent' ), __( 'Meta Pixel, Google Ads, TikTok, LinkedIn, Pinterest...', 'cookie-consent' ) ),
			'media'     => array( __( 'Embedded media', 'cookie-consent' ), __( 'YouTube, Vimeo, Google Maps, Spotify, Instagram...', 'cookie-consent' ) ),
		);
		$positions  = array(
			'bar'    => __( 'Bar at the bottom', 'cookie-consent' ),
			'box'    => __( 'Box in the corner', 'cookie-consent' ),
			'center' => __( 'Window in the middle', 'cookie-consent' ),
		);
		$scan_url   = add_query_arg( 'cookie-scan', '1', home_url( '/' ) );
		?>
		<div class="wrap ccwp">
			<h1><?php esc_html_e( 'Cookie consent', 'cookie-consent' ); ?></h1>
			<p class="ccwp-lead">
				<?php esc_html_e( 'The banner loads first on every page and holds back known trackers and embeds until each visitor agrees. Accept and Reject are equally easy, and nothing is ticked in advance.', 'cookie-consent' ); ?>
			</p>

			<form method="post" action="options.php">
				<?php settings_fields( 'ccwp' ); ?>

				<div class="ccwp-card">
					<h2><?php esc_html_e( 'Banner', 'cookie-consent' ); ?></h2>
					<table class="form-table" role="presentation">
						<tr>
							<th scope="row"><?php esc_html_e( 'Status', 'cookie-consent' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="<?php echo esc_attr( self::field_name( 'enabled' ) ); ?>" value="1" <?php checked( $o['enabled'] ); ?>>
									<?php esc_html_e( 'Show the banner and block trackers', 'cookie-consent' ); ?>
								</label>
							</td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Cookies this site uses', 'cookie-consent' ); ?></th>
							<td>
								<fieldset>
									<label class="ccwp-check"><input type="checkbox" checked disabled> <strong><?php esc_html_e( 'Necessary', 'cookie-consent' ); ?></strong> <span class="description"><?php esc_html_e( 'Always on', 'cookie-consent' ); ?></span></label>
									<?php foreach ( $cat_labels as $cat => $label ) : ?>
										<label class="ccwp-check">
											<input type="checkbox" name="<?php echo esc_attr( self::field_name( 'categories' ) ); ?>[]" value="<?php echo esc_attr( $cat ); ?>" <?php checked( in_array( $cat, $o['categories'], true ) ); ?>>
											<strong><?php echo esc_html( $label[0] ); ?></strong>
											<span class="description"><?php echo esc_html( $label[1] ); ?></span>
										</label>
									<?php endforeach; ?>
									<p class="description"><?php esc_html_e( 'Visitors only see the categories ticked here.', 'cookie-consent' ); ?></p>
								</fieldset>
							</td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Position', 'cookie-consent' ); ?></th>
							<td>
								<fieldset>
									<?php foreach ( $positions as $value => $label ) : ?>
										<label class="ccwp-radio"><input type="radio" name="<?php echo esc_attr( self::field_name( 'position' ) ); ?>" value="<?php echo esc_attr( $value ); ?>" <?php checked( $o['position'], $value ); ?>> <?php echo esc_html( $label ); ?></label>
									<?php endforeach; ?>
								</fieldset>
							</td>
						</tr>
						<tr>
							<th scope="row"><label for="ccwp-accent"><?php esc_html_e( 'Button colour', 'cookie-consent' ); ?></label></th>
							<td><input id="ccwp-accent" class="ccwp-color" type="text" name="<?php echo esc_attr( self::field_name( 'accent' ) ); ?>" value="<?php echo esc_attr( $o['accent'] ); ?>" data-default-color="#2563eb"></td>
						</tr>
						<tr>
							<th scope="row"><label for="ccwp-policy"><?php esc_html_e( 'Cookie policy page', 'cookie-consent' ); ?></label></th>
							<td>
								<?php
								wp_dropdown_pages(
									array(
										'name'              => esc_attr( self::field_name( 'policy_page' ) ),
										'id'                => 'ccwp-policy',
										'selected'          => (int) $o['policy_page'],
										'show_option_none'  => esc_html__( '— None —', 'cookie-consent' ),
										'option_none_value' => '0',
									)
								);
								?>
								<p class="description"><?php esc_html_e( 'Linked from the banner. The AEPD expects one.', 'cookie-consent' ); ?></p>
							</td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Change of mind', 'cookie-consent' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="<?php echo esc_attr( self::field_name( 'floating' ) ); ?>" value="1" <?php checked( $o['floating'] ); ?>>
									<?php esc_html_e( 'Show a small cookie button so visitors can change their choice', 'cookie-consent' ); ?>
								</label>
								<p class="description">
									<?php
									/* translators: %s: the [cookie_settings] shortcode */
									printf( esc_html__( 'You can also put %s in your footer or cookie policy.', 'cookie-consent' ), '<code>[cookie_settings]</code>' );
									?>
								</p>
							</td>
						</tr>
					</table>
				</div>

				<div class="ccwp-card">
					<h2><?php esc_html_e( 'Texts', 'cookie-consent' ); ?></h2>
					<p class="description"><?php esc_html_e( 'Leave empty to use the built-in texts. The language follows the site language.', 'cookie-consent' ); ?></p>
					<table class="form-table" role="presentation">
						<?php foreach ( array( 'en' => 'English', 'es' => 'Español' ) as $lang => $lang_name ) : ?>
							<tr>
								<th scope="row"><?php echo esc_html( $lang_name ); ?></th>
								<td class="ccwp-texts">
									<input type="text" class="regular-text" placeholder="<?php esc_attr_e( 'Title', 'cookie-consent' ); ?>" aria-label="<?php echo esc_attr( $lang_name . ': ' . __( 'Title', 'cookie-consent' ) ); ?>" name="<?php echo esc_attr( self::field_name( 'texts', $lang, 'title' ) ); ?>" value="<?php echo esc_attr( $o['texts'][ $lang ]['title'] ); ?>">
									<textarea rows="3" class="large-text" placeholder="<?php esc_attr_e( 'Message', 'cookie-consent' ); ?>" aria-label="<?php echo esc_attr( $lang_name . ': ' . __( 'Message', 'cookie-consent' ) ); ?>" name="<?php echo esc_attr( self::field_name( 'texts', $lang, 'message' ) ); ?>"><?php echo esc_textarea( $o['texts'][ $lang ]['message'] ); ?></textarea>
								</td>
							</tr>
						<?php endforeach; ?>
					</table>
				</div>

				<div class="ccwp-card">
					<h2><?php esc_html_e( 'Advanced', 'cookie-consent' ); ?></h2>
					<table class="form-table" role="presentation">
						<tr>
							<th scope="row"><label for="ccwp-rules"><?php esc_html_e( 'Your own rules', 'cookie-consent' ); ?></label></th>
							<td>
								<textarea id="ccwp-rules" rows="5" class="large-text code" name="<?php echo esc_attr( self::field_name( 'rules_text' ) ); ?>" placeholder="analytics: plausible.io : Plausible&#10;marketing: /ads\.example\.(com|net)/&#10;necessary: cdn.mysite.com"><?php echo esc_textarea( $o['rules_text'] ); ?></textarea>
								<p class="description">
									<?php esc_html_e( 'One per line: category, a colon, then text that appears in the script or iframe address (or a /regular expression/). Add " : Name" at the end to name it. Use "necessary" to make sure something is never blocked. Your rules are checked before the built-in ones.', 'cookie-consent' ); ?>
								</p>
							</td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Server-side blocking', 'cookie-consent' ); ?></th>
							<td>
								<input type="hidden" name="<?php echo esc_attr( self::field_name( 'rewrite' ) ); ?>" value="0">
								<label>
									<input type="checkbox" name="<?php echo esc_attr( self::field_name( 'rewrite' ) ); ?>" value="1" <?php checked( $o['rewrite'] ); ?>>
									<?php esc_html_e( 'Also hold trackers back in the page itself (recommended)', 'cookie-consent' ); ?>
								</label>
								<p class="description"><?php esc_html_e( 'Browsers start downloading scripts and loading embeds before any JavaScript can stop them. With this on, the plugin changes them in the page before it is sent, so nothing is requested until the visitor agrees. It works with page caching.', 'cookie-consent' ); ?></p>
							</td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Google Consent Mode', 'cookie-consent' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="<?php echo esc_attr( self::field_name( 'consent_mode' ) ); ?>" value="1" <?php checked( $o['consent_mode'] ); ?>>
									<?php esc_html_e( 'Send consent signals (v2) to Google tags', 'cookie-consent' ); ?>
								</label>
							</td>
						</tr>
						<tr>
							<th scope="row"><label for="ccwp-days"><?php esc_html_e( 'Remember choices for', 'cookie-consent' ); ?></label></th>
							<td>
								<input id="ccwp-days" type="number" min="1" max="730" class="small-text" name="<?php echo esc_attr( self::field_name( 'expires_days' ) ); ?>" value="<?php echo esc_attr( (string) $o['expires_days'] ); ?>">
								<?php esc_html_e( 'days (at most 730, as the AEPD recommends 24 months or less)', 'cookie-consent' ); ?>
							</td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Ask everyone again', 'cookie-consent' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="<?php echo esc_attr( self::field_name( 'ask_again' ) ); ?>" value="1">
									<?php esc_html_e( 'Show the banner again to all visitors when I save (for example, after adding a new tracker)', 'cookie-consent' ); ?>
								</label>
								<p class="description">
									<?php
									/* translators: %d: consent revision number */
									printf( esc_html__( 'Current revision: %d', 'cookie-consent' ), (int) $o['revision'] );
									?>
								</p>
							</td>
						</tr>
					</table>
				</div>

				<?php submit_button(); ?>
			</form>

			<div class="ccwp-card ccwp-side">
				<h2><?php esc_html_e( 'Find out what your site uses', 'cookie-consent' ); ?></h2>
				<p><?php esc_html_e( 'Scan mode opens your site with a panel listing its cookies, stored data, outside scripts and embeds. Anything marked "unknown" may need a rule.', 'cookie-consent' ); ?></p>
				<p><a class="button" href="<?php echo esc_url( $scan_url ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Open scan mode', 'cookie-consent' ); ?></a></p>
				<h2><?php esc_html_e( 'Good to know', 'cookie-consent' ); ?></h2>
				<ul>
					<li><?php esc_html_e( 'Cookies set by your own server (for example by a shop or login) can\'t be blocked from the browser. They are usually "necessary".', 'cookie-consent' ); ?></li>
					<li><?php esc_html_e( 'Trackers the plugin doesn\'t know need a rule. Scan mode helps you find them.', 'cookie-consent' ); ?></li>
					<li><?php esc_html_e( 'Without server-side blocking, scripts printed in your theme before wp_head() run before the banner. Keep it on unless it causes a problem.', 'cookie-consent' ); ?></li>
				</ul>
			</div>
		</div>
		<?php
	}
}
