<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

/**
 * Home Assistant ingress (added by the LaraPaper (local) app).
 *
 * Screen images link to APP_URL/storage/..., the address the TRMNL uses, which a browser
 * outside the home network can't reach. Requests through ingress (nginx sets
 * LARAPAPER_INGRESS there) link to them through ingress instead.
 */
class IngressServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if (! $this->app->runningInConsole() && request()->server('LARAPAPER_INGRESS')) {
            config(['filesystems.disks.public.url' => asset('storage')]);
        }
    }
}
