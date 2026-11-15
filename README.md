# DLS 6.0 Umpire Calculator — Development

This is the **development deployment** of the DLS 6.0 Umpire Calculator. It is a separate copy of the application sourced from the `dev` branch of the main project repository.

- Development site: https://jou-ma.github.io/dls60-umpire-dev/
- Source repository: https://github.com/Jou-Ma/dls60-umpire/tree/dev
- Production site: https://jou-ma.github.io/dls60-umpire/

## Important differences from production

- This copy is clearly marked as DEVELOPMENT.
- Match records are saved only in the current browser/device.
- Uploads to the production private match archive are disabled in this deployment.
- The development service worker uses its own cache name and only removes development caches. It must not clear production caches.
- This deployment is for interface and workflow testing. Do not use it as the official match-day calculator.

The calculation engine and application functionality are initially copied from the development branch. Changes made here do not automatically flow back to the source repository or production.

## Enable GitHub Pages

In this repository, open **Settings → Pages** and select **Deploy from a branch**, branch **main**, folder **/ (root)**, then Save.
