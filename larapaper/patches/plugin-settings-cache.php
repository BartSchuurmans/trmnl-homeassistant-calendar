            // ha-calendar patch (larapaper/Dockerfile): LaraPaper only drops the cached
            // screen when the markup changes, so a device kept showing a screen rendered
            // with the old settings until the data went stale. Settings that change what
            // is polled also force a new poll; the others force a new render.
            if ($model->isDirty([
                'configuration',
                'data_strategy',
                'polling_url',
                'polling_verb',
                'polling_header',
                'polling_body',
                'transform_code',
                'transform_language',
            ])) {
                $model->data_payload_updated_at = null;
            }
            if ($model->isDirty([
                'configuration',
                'name',
                'markup_language',
                'render_markup_view',
                'framework_version',
                'preferred_renderer',
                'no_bleed',
                'dark_mode',
            ]) || ($model->data_strategy === 'static' && $model->isDirty('data_payload'))) {
                $model->current_image = null;
                $model->current_image_metadata = null;
            }
