<?php
// Read-only observation of the actual source. No reseeding or source updates.
if (!defined('WP_CLI') || !WP_CLI || get_option('composer_weekender_fixture') !== '1') {
    WP_CLI::error('Select the registered fictional WordPress source.');
}
$owner = get_user_by('login', 'fictional-editor');
if (!$owner || !user_can($owner, 'manage_options')) {
    WP_CLI::error('The selected fictional source owner is unavailable.');
}
wp_set_current_user($owner->ID);
$statuses = ['publish', 'draft', 'private', 'pending', 'future'];
$articles = [];
$pages = [];
foreach (['post', 'page'] as $type) {
    $items = get_posts([
        'post_type' => $type, 'post_status' => $statuses, 'numberposts' => 101,
        'orderby' => 'ID', 'order' => 'ASC'
    ]);
    if (count($items) > 100) {
        WP_CLI::error('This bounded publisher lab supports at most 100 entries per type.');
    }
    foreach ($items as $post) {
        $author = get_userdata($post->post_author);
        $record = [
            'id' => $post->ID, 'slug' => $post->post_name,
            'title' => $post->post_title, 'status' => $post->post_status,
            'url' => get_permalink($post),
            'author' => $author ? $author->user_login : null,
            'authorName' => $author ? $author->display_name : null,
            'parentId' => $post->post_parent, 'excerpt' => $post->post_excerpt,
            'text' => trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags($post->post_content))),
            'dateUTC' => $post->post_date_gmt,
            'featuredImage' => get_post_thumbnail_id($post),
            'categories' => wp_get_post_terms($post->ID, 'category', ['fields' => 'names']),
            'tags' => wp_get_post_terms($post->ID, 'post_tag', ['fields' => 'names'])
        ];
        if ($type === 'post') {
            $articles[] = $record;
        } else {
            $pages[] = $record;
        }
    }
}
$attachments = get_posts([
    'post_type' => 'attachment', 'post_status' => 'inherit', 'numberposts' => 101,
    'orderby' => 'ID', 'order' => 'ASC'
]);
if (count($attachments) > 100) {
    WP_CLI::error('The bounded source attachment inventory exceeds 100.');
}
$media = [];
foreach ($attachments as $item) {
    $file = get_attached_file($item->ID);
    if (!is_file($file)) {
        WP_CLI::error('A source attachment is unavailable.');
    }
    $media[] = [
        'id' => $item->ID, 'url' => wp_get_attachment_url($item->ID),
        'title' => $item->post_title,
        'alt' => get_post_meta($item->ID, '_wp_attachment_image_alt', true),
        'caption' => $item->post_excerpt, 'description' => $item->post_content,
        'mime' => get_post_mime_type($item->ID),
        'bytes' => filesize($file), 'sha256' => hash_file('sha256', $file)
    ];
}
$comments = get_comments(['status' => 'all', 'number' => 101, 'orderby' => 'comment_ID', 'order' => 'ASC']);
if (count($comments) > 100) {
    WP_CLI::error('The bounded source comment inventory exceeds 100.');
}
$comments = array_map(fn($comment) => [
    'id' => (int)$comment->comment_ID, 'postId' => (int)$comment->comment_post_ID,
    'parentId' => (int)$comment->comment_parent, 'author' => $comment->comment_author,
    'content' => $comment->comment_content, 'status' => $comment->comment_approved
], $comments);
$taxonomies = [];
foreach (['category', 'post_tag'] as $taxonomy) {
    $terms = get_terms(['taxonomy' => $taxonomy, 'hide_empty' => false, 'number' => 201]);
    if (is_wp_error($terms) || count($terms) > 200) {
        WP_CLI::error('The bounded source taxonomy inventory is unavailable or exceeds 200.');
    }
    $taxonomies[$taxonomy] = array_map(fn($term) => [
        'id' => $term->term_id, 'slug' => $term->slug,
        'name' => $term->name, 'parentId' => $term->parent
    ], $terms);
}
WP_CLI::line(json_encode([
    'fictional' => true, 'version' => get_bloginfo('version'),
    'site' => ['title' => get_bloginfo('name'), 'origin' => get_option('home')],
    'timezone' => wp_timezone_string(), 'permalink' => get_option('permalink_structure'),
    'articles' => $articles, 'pages' => $pages, 'media' => $media,
    'comments' => $comments, 'taxonomies' => $taxonomies
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
