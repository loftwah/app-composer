<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip-link" href="#main">Skip to stories</a>
<header class="site-header wrap">
    <a class="site-name" href="<?php echo esc_url(home_url('/')); ?>">Macedon Weekender</a>
    <p>Walks, good tables and field notes for a considered weekend.</p>
    <nav aria-label="Main navigation"><?php wp_nav_menu(['theme_location' => 'primary', 'container' => false, 'fallback_cb' => false]); ?></nav>
</header>
<main id="main" class="wrap">
