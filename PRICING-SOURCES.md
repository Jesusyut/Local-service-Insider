# San Diego seed-price research

Checked November 11, 2026. Sources are local service providers' own published pages. These are asking or starting prices, not a survey of completed transactions or an endorsement/paid partnership. Search snippets sometimes differed from current pages; the current opened pages were used.

The executable samples and source notes are in `server/seeds.mjs`. For each supported option/body type, low and high bound the listed sample and typical is its median, rounded to a whole dollar. General installer bands are marked as broad estimates rather than invented size multipliers. An owner-entered range overrides the bundled research and is not overwritten on restart.

| Source | How it is used |
| --- | --- |
| [Coastal Tint local price guide](https://coastaltintsd.com/blog/window-tint-cost-san-diego-2026) | Dyed/carbon bands for standard side/rear coverage; ceramic band and windshield starting price. The guide is broad across vehicle sizes and is labeled accordingly. |
| [San Diego Auto Tint Shop booking](https://sandiegoautomotivewindowtint.com/book) | Ceramic side/rear package explicitly covering sedan/SUV/four-door trucks, and ceramic windshield service. |
| [Carbix coating guide](https://carbixautodetailing.com/guides/ceramic-coating-cost-san-diego) | Exterior-only coating rates by duration and body-size category. This provider labels its guide 2025; research notes retain the URL and preparation differences. |
| [Fresh Layer coating pricing](https://www.fresh-layer.com/ceramic-coating-san-diego) | One- and three-year coating packages for sedan, SUV and truck. No sedan price is silently assigned to a coupe. |
| [Auto Alchemy coating pricing](https://autoalchemymobiledetailing.com/services/ceramic-coating-san-diego/) | Three- and five-year packages for car/small SUV and truck/two-row SUV. |
| [DRIVEN Detailers](https://www.drivendetailers.org/) | Full detail by sedan/coupe, crossover, truck/large SUV. Maintenance-only packages excluded. |
| [Del Mar Detailing](https://delmardetailing.com/detailing) | Full detail by coupe, sedan, crossover, SUV/truck. Maintenance and showroom restoration tiers excluded. |
| [ZS Clean](https://www.zscleansandiego.com/pricing) | Complete interior/exterior detail by coupe/sedan and SUV/truck. Coating/restoration bundles excluded. |

Some provider packages differ in preparation, material grade, size subcategories and included protection. The result page explicitly labels seed estimates. Narrow bands based on a small number of published rates are not presented as market-wide averages.

The broader coating fallback pools the researched duration tiers for the same body type, and is used for “Not sure.” It is not used to substitute all-window tint for windshield tint or partial PPF for full-body PPF. PPF, wraps, interior-only/exterior-only detailing and unresearched vehicle categories remain hidden. Sources are research inputs only: no shop has been added as a vetted/paid partner merely because its prices are cited.
