<?php get_header(); ?>
<?php if (is_singular()): ?>
    <?php while (have_posts()): the_post(); ?>
    <article <?php post_class('story'); ?>>
        <a href="<?php echo esc_url(home_url('/')); ?>">Back to the latest stories</a>
        <h1><?php the_title(); ?></h1>
        <?php if (is_single()): ?><p class="byline">By <?php the_author(); ?> · <time datetime="<?php echo esc_attr(get_the_date(DATE_W3C)); ?>"><?php echo esc_html(get_the_date()); ?></time></p><?php endif; ?>
        <?php if (has_post_thumbnail()): ?><figure><?php the_post_thumbnail('large'); ?><figcaption><?php echo esc_html(wp_get_attachment_caption(get_post_thumbnail_id())); ?></figcaption></figure><?php endif; ?>
        <div class="prose"><?php the_content(); ?></div>
        <?php if (is_single()): ?><nav class="story-neighbours" aria-label="More stories"><?php previous_post_link('%link', 'Previous: %title'); ?><?php next_post_link('%link', 'Next: %title'); ?></nav><?php endif; ?>
    </article>
    <?php endwhile; ?>
<?php else: ?>
    <header class="edition-heading">
        <?php if (is_search()): ?><h1>Search the Weekender</h1><p>Stories matching “<?php echo esc_html(get_search_query()); ?>”.</p>
        <?php elseif (is_archive()): ?><h1><?php the_archive_title(); ?></h1><?php the_archive_description(); ?>
        <?php elseif (is_404()): ?><h1>This story is unavailable.</h1><p>Return to the archive or find another story.</p>
        <?php else: ?><p class="eyebrow">A fictional regional magazine</p><h1>A little further<br>from the rush.</h1><p>Take a slower route through the weekend.</p><?php endif; ?>
        <?php get_search_form(); ?>
    </header>
    <div class="stories">
    <?php while (have_posts()): the_post(); ?>
        <article <?php post_class('story-card'); ?>>
            <?php if (has_post_thumbnail()): ?><a tabindex="-1" aria-hidden="true" href="<?php the_permalink(); ?>"><?php the_post_thumbnail('medium_large', ['alt' => '']); ?></a><?php endif; ?>
            <div><p class="eyebrow"><?php echo esc_html(get_the_date()); ?> · <?php the_author(); ?></p><h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2><?php the_excerpt(); ?></div>
        </article>
    <?php endwhile; ?>
    </div>
    <?php the_posts_pagination(['mid_size' => 1, 'prev_text' => 'Newer stories', 'next_text' => 'Earlier stories']); ?>
<?php endif; ?>
<?php get_footer(); ?>
