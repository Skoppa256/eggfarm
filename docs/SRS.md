# EggFarm IMS — Software Requirements Specification (v2.0)

> **Status:** Draft — For Review · **Date:** June 2026 · **Author:** Amadeo Yesa · **Company:** CV Piawai Djaya Farm
>
> This is the markdown copy of the SRS for in-repo reference by Claude Code. The distilled, always-true engineering rules live in [`/CLAUDE.md`](../CLAUDE.md); this document is the full requirement reference (FR-level detail, data model, use cases, ripple analysis).
> This version supersedes v1.3 and adds the Flock & Daily Farmhouse Recording layer and the PAKAN, OVK, and VAKSIN operational modules.

---

|                      |                               |
|----------------------|-------------------------------|
| **Document Version** | 2.0 — Draft                   |
| **Prepared For**     | Egg Farm Owner / Stakeholders |
| **Prepared By**      | Amadeo Yesa                   |
| **Company**          | CV Piawai Djaya Farm          |
| **Date**             | June 2026                     |
| **Status**           | For Review                    |

*This version supersedes v1.3 (May 2026) and introduces the Flock & Daily Farmhouse Recording layer and the PAKAN, OVK, and VAKSIN operational modules.*

# 1. Introduction

## 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements for the Egg Farm Inventory Management System (EggFarm IMS). It is the reference for developers, designers, and stakeholders building the system. Version 2.0 extends the egg inventory scope of v1.3 with a full flock production, feed, and animal-health operations layer, reflecting the farm's complete daily recording practice.

## 1.2 Project Background

The farm previously managed both egg inventory and daily flock operations using spreadsheets across several disconnected sheets: egg collection from farmhouses (kandang), grading, warehouse distribution, daily flock recording (production, feed, mortality, body weight, treatments), feed mixing recipes, and medicine/vitamin usage logs. As operations grew, maintaining these sheets became error-prone and difficult to analyse, and the sheets did not reconcile with one another. EggFarm IMS replaces the entire spreadsheet set with one integrated digital system in which a single day's egg counts, feed mix, and flock health all derive from shared, reconciled data.

## 1.3 Scope

EggFarm IMS v2.0 covers the following operational areas:

- Farmhouse (kandang) collection input — per batch, configurable number of batches per day — recording good eggs, defective eggs (retak, lunak), and empty shells (kosong), plus Angkat Rak captured by Type per lift.

- Grading process — per batch, sequential completion enforced — across two dimensions: Grade by Size & Health and Grade by Type, with Type captured via tabbed entry.

- Angkat Rak (ungraded) bypass — eggs that skip grading and flow directly to warehouse, carrying a Type per lift.

- Warehouse stock management with farmhouse-to-warehouse mapping, tracked per Egg SKU, in the rak/pcs unit system.

- Sales & dispatch to pre-registered buyers, and buyer management.

- Flock management & lifecycle — chick-in, day-to-day, and end — with each flock spanning one or more farmhouses as separate placements.

- Daily farmhouse recording — one record per kandang per day capturing mortality, feed, body weight, treatments, and derived production/health indicators (HD%, FCR, intake).

- PAKAN (feed) management — central raw-ingredient inventory, per-kandang daily mixing recipes, a printable ingredient pull-list, and automatic feed consumption into the daily record.

- OVK (Obat / Vitamin / Chemical) inventory — deliveries into the office store and office-to-kandang transfers, with a usage (pemakaian) report.

- VAKSIN logging — vaccination activity logs (no inventory).

- Dashboard and reporting for stakeholders with charts, KPIs, and exportable data.

- Configuration & master-data management without developer involvement.

## 1.4 Intended Users

Version 2.0 retains the three-role model introduced in v1.3. The distinction between operational structure (managed by Admin) and master/catalog data (managed by Superadmin) is made explicit because v2.0 adds several new catalogs.

| **User Role**  | **Description**                                                                                                                                                                                                                                                                                                                                                                                                                           |
|----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Superadmin** | Full system access including user management; creation and lifecycle of flocks (chick-in); and all master/catalog data: measurement units, Grade by Type list, feed ingredients, OVK items, and vaksin types. Typically a developer or system owner. Can perform any action any other role can.                                                                                                                                           |
| **Owner**      | Read-only access to the stakeholder dashboard, KPI cards, production and flock-health charts, warehouse stock summaries, and all reports. Cannot submit data entries or change configuration. Intentionally limited to observation and analytical insight.                                                                                                                                                                                |
| **Admin**      | All day-to-day operational work: farmhouse collection input, grading input, warehouse management, sales & dispatch, buyer management, stock corrections, daily farmhouse recording, feed delivery and daily mixing recipes, OVK deliveries and transfers, vaksin logging, and operational configuration (farmhouses, warehouses, mapping, buyers). Cannot manage user accounts, flock creation, or master/catalog data (Superadmin only). |

## 1.5 Definitions and Abbreviations

| **Term**                   | **Definition**                                                                                                                                                                                                                |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Kandang**                | Indonesian: farmhouse / chicken coop (e.g. Kandang A, Kandang 1). The primary production unit and the unit at which a flock is placed and recorded daily.                                                                     |
| **Flock**                  | A single chick-in delivery of hens sharing one strain, one chick-in date, and one placement age. A flock may populate one or more kandang. Strain, chick-in date, and age are shared across the flock.                        |
| **Placement**              | The portion of a flock placed in one specific kandang, with its own initial population (Populasi Awal) and its own daily recording ledger, mortality balance, and production. One flock has one or more placements.           |
| **Populasi Awal**          | Initial population: the number of hens placed in a kandang at chick-in. A per-placement value, not a flock-wide value.                                                                                                        |
| **Batch**                  | One gathering cycle per farmhouse. Each kandang has a configurable number of batches per day (default 2, up to a configurable maximum). A batch is Type-agnostic at collection. Grading is per batch and sequential.          |
| **Angkat Rak**             | Literally 'rack lift' — eggs that bypass grading entirely and flow directly to the warehouse as ungraded stock. A Grade by Size & Health value in its own right. Captured at collection and carries a Grade by Type per lift. |
| **Grade by Size & Health** | Primary grading dimension: Angkat Rak, A++, A+, A, B, C, Telur Kecil, Telur Mini, Telur Retak, Telur Plastik, Telur Lunak. (Telur Kosong is tracked but never stocked.)                                                       |
| **Grade by Type**          | Secondary dimension describing production origin / feed: Normal Egg, Omega Egg, extensible by Superadmin. Determined by hen feed, established through physical separation rather than visual inspection.                      |
| **Egg SKU**                | The combination of a Size & Health grade and a Type grade, uniquely identifying a sellable egg variant for stock and sales (e.g. Grade A / Omega Egg). Every active Size & Health grade × active Type grade is a valid SKU.   |
| **Telur Utuh**             | Daily-recording bucket for intact sellable eggs: all clean grades (A++ through Telur Mini) plus Angkat Rak. A reporting roll-up, not a grade.                                                                                 |
| **Telur Lunak**            | Soft-shelled defective eggs. A saleable Size & Health grade that enters warehouse stock. Reported as its own daily bucket because it is a hen-health (shell quality) signal.                                                  |
| **Telur Pecah**            | Daily-recording bucket for broken eggs: Telur Retak + Telur Plastik. Both are saleable and enter stock. Reported together because breakage is largely a mechanical / handling signal.                                         |
| **Telur Retak**            | Cracked eggs. Saleable; enters stock. Recorded at collection and confirmed at grading.                                                                                                                                        |
| **Telur Plastik**          | Severely cracked eggs placed in plastic containers during grading. Saleable; pcs only, no rak conversion. Carved out of Retak during grading.                                                                                 |
| **Telur Kosong**           | Empty shells (contents gone due to mechanical failure). Never sellable and never enters stock. Tracked only as a hen-productivity / health indicator; included in HD% because the hen still laid.                             |
| **Rak**                    | Standard sales and reporting unit. 1 rak = 30 pcs. Replaces the v1.3 'tray'. Quantities are stored internally in pcs and displayed as a mixed 'X rak + Y pcs' figure.                                                         |
| **Pcs**                    | Pieces — the base internal unit for all egg quantities.                                                                                                                                                                       |
| **HD% (Hen-Day %)**        | Production indicator = (all eggs laid that day: Utuh + Lunak + Pecah + Kosong) ÷ HIDUP × 100. Uses all eggs because it tracks hen productivity/health, not sellable output.                                                   |
| **FCR**                    | Feed Conversion Ratio = REALISASI INTAKE (kg feed eaten) ÷ BERAT TELUR (kg egg mass), computed daily. (Replaces a mislabeled feed-salvage ratio used on the old spreadsheet.)                                                 |
| **HIDUP**                  | Running live-hen count for a placement = previous day's HIDUP − MATI − AFKIR. Stateful across the flock's life.                                                                                                               |
| **MATI / AFKIR**           | Daily deaths / daily culls, entered by Admin; both reduce HIDUP.                                                                                                                                                              |
| **PAKAN MASUK**            | The fresh netted feed mixed for and delivered to a kandang on the consumption day (= requirement − reusable leftover carried from yesterday). Derived from the mixing event.                                                  |
| **PAKAN TERSEDIA**         | Total feed available to the hens that day = PAKAN MASUK + yesterday's reusable leftover. The quantity REALISASI INTAKE is measured against.                                                                                   |
| **SISA DIGUNAKAN**         | Reusable leftover feed at day end; carries into the next day's mix as a credit (the next mix is netted down by it).                                                                                                           |
| **SISA DIBUANG**           | Discarded / expired leftover feed; removed and does not carry forward.                                                                                                                                                        |
| **REALISASI INTAKE**       | Actual feed eaten = PAKAN TERSEDIA − (SISA DIGUNAKAN + SISA DIBUANG).                                                                                                                                                         |
| **GRAM/EKOR**              | Feed intake per bird = REALISASI INTAKE ÷ HIDUP × 1000 (grams).                                                                                                                                                               |
| **TOTAL CAMPUR**           | The fresh mix weight produced by a mixing event (= PAKAN MASUK). Main feeds are set by percentage of this amount; supplements/premix by fixed weight.                                                                         |
| **PAKAN**                  | Feed. The feed module covers raw-ingredient inventory, per-kandang mixing recipes, and consumption.                                                                                                                           |
| **OVK**                    | Obat, Vitamin, Chemical — the combined medicine/vitamin/chemical inventory module.                                                                                                                                            |
| **VAKSIN**                 | Vaccination. Logged as activity only; no inventory is tracked.                                                                                                                                                                |
| **Stock Correction**       | A supervised manual adjustment of warehouse egg stock by an Admin to reconcile physical counts, requiring a mandatory reason and logged as a distinct movement type.                                                          |
| **IMS / KPI**              | Inventory Management System / Key Performance Indicator.                                                                                                                                                                      |

# 2. Overall System Description

## 2.1 Operational Workflow

The system models the farm's full daily operation. Egg production flows through a three-stage pipeline (collection, grading, warehouse), while a parallel flock layer records the daily life of the hens and feeds the feed and treatment modules. The two meet in the daily farmhouse record, where egg counts and feed/health data for one kandang-day reconcile.

| **#** | **Stage**                     | **Details**                                                                                                                                                                                                                                                                                        |
|--------|-------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1      | **Farmhouse Collection**      | Admins input egg counts per batch per kandang. Each batch records Good Eggs, Telur Retak, Telur Lunak, and Telur Kosong in pcs (Type-agnostic). Angkat Rak is captured here and split by Type per lift. Batches must be completed before grading begins.                                           |
| 2      | **Grading Process**           | Done centrally, per batch, sequentially. Staff count and enter quantities by Size & Health grade under a Type tab (Normal / Omega / …). Input is in rak (pcs for Telur Plastik and Telur Lunak). The live counter reconciles across all Type tabs against the batch's available quantity.          |
| 3      | **Warehouse Dispatch**        | Graded eggs and Angkat Rak are routed to the assigned warehouse per the farmhouse-to-warehouse mapping. Stock is tracked per Egg SKU in pcs, displayed as rak + pcs.                                                                                                                               |
| 4      | **Daily Farmhouse Recording** | One record per kandang per day for the active flock placement: Admin enters mortality, feed leftovers, egg mass, periodic body weight, and treatment notes. The system derives age, HIDUP, intake, egg buckets, HD%, and FCR.                                                                      |
| 5      | **Feed Mixing (PAKAN)**       | Each consumption day, the Admin sets a per-kandang recipe. The system computes the mix from population × projected intake, netted by reusable leftover, draws down raw ingredients from the central store, prints a pull-list for the feed warehouse, and posts PAKAN MASUK into the daily record. |
| 6      | **OVK & VAKSIN**              | OVK stock is added on delivery to the office and reduced on transfer to a kandang. Vaccinations are logged as activity. Treatments and vaccinations surface on the daily record.                                                                                                                   |

## 2.2 Egg Grade Reference

Eggs are graded across two independent dimensions whose combination forms the Egg SKU. Angkat Rak and Telur Lunak are full members of the Size & Health dimension.

**Dimension 1: Grade by Size & Health**

| **Grade**         | **Unit**  | **Stage**            | **Enters Stock?** | **Notes**                                                                               |
|-------------------|-----------|----------------------|-------------------|-----------------------------------------------------------------------------------------|
| **Angkat Rak**    | Rak / pcs | Collection bypass    | Yes — as ungraded | Bypasses grading. Flows to warehouse on collection save. Carries a Type per lift.       |
| **Grade A++**     | Rak / pcs | Grading              | Yes               | Highest quality grade.                                                                  |
| **Grade A+**      | Rak / pcs | Grading              | Yes               | High quality grade.                                                                     |
| **Grade A**       | Rak / pcs | Grading              | Yes               | Standard quality grade.                                                                 |
| **Grade B**       | Rak / pcs | Grading              | Yes               | Second quality grade.                                                                   |
| **Grade C**       | Rak / pcs | Grading              | Yes               | Third quality grade.                                                                    |
| **Telur Kecil**   | Rak / pcs | Grading              | Yes               | Small eggs.                                                                             |
| **Telur Mini**    | Rak / pcs | Grading              | Yes               | Very small eggs, smaller than Telur Kecil.                                              |
| **Telur Retak**   | Rak / pcs | Grading              | Yes               | Cracked eggs confirmed at grading; also recorded at collection.                         |
| **Telur Plastik** | Pcs only  | Grading              | Yes               | Severely cracked eggs in plastic containers. Pcs only; carved out of Retak at grading.  |
| **Telur Lunak**   | Pcs       | Collection + Grading | Yes               | Soft-shelled defective eggs. Saleable; enters stock. A hen-health signal.               |
| **Telur Kosong**  | Pcs       | Collection only      | **NO — never**    | Empty shells. Hen-productivity indicator only. Never stocked or graded; counted in HD%. |

**Dimension 2: Grade by Type**

| **Type Grade** | **Description**                                            | **Notes**                                                         |
|----------------|------------------------------------------------------------|-------------------------------------------------------------------|
| **Normal Egg** | Standard production eggs with no special feed distinction. | Default type.                                                     |
| **Omega Egg**  | Eggs from hens fed an omega-3 enriched diet.               | Tracked separately in stock and sales; typically a price premium. |

Additional Type grades can be added by **Superadmin** without code changes. **Every active Size & Health grade combined with every active Type grade is a valid Egg SKU (full matrix); no per-combination allow-list is maintained.** All stock, warehouse levels, and sales are tracked and reported at the Egg SKU level.

## 2.3 Type Capture by Physical Separation

An Omega egg and a Normal egg are visually identical, so Type cannot be assigned by sight. Type is provenance: it follows which feed the laying hens received. The farm keeps Omega and Normal egg streams physically separated from the rows through to grading and lifting, so Type is captured wherever that separation is still visible — and never requires the batch itself to be split:

- **Collection is Type-agnostic** for Good/Retak/Lunak/Kosong — one batch entry, single numbers. This protects entry speed.

- **Angkat Rak is split by Type per lift** at collection: because each lift is pulled from known racks, the Admin records a Normal quantity and an Omega quantity (the Omega field stays hidden/zero until needed). A single lift may legitimately contain both Types.

- **Grading is Type-aware via tabs**: within one batch's grading session the grader enters the physically-separated Omega pile under the Omega tab and the Normal pile under the Normal tab, using the same 11-grade Size & Health column under each tab. The live counter sums across all tabs and reconciles against the batch's available quantity.

**Known, accepted limitation:** because a batch's Good Eggs are not Type-split at collection, the system reconciles graded quantity as a single combined total against available quantity — it cannot cross-check Omega-graded against Omega-available. This integrity rests on the farm's physical separation, by design.

## 2.4 Unit System & Rounding

The standard unit across the whole application is rak / pcs, with 1 rak = 30 pcs. The system supports multiple configurable units (e.g. additional crate/carton sizes), managed by Superadmin. The following rules apply everywhere a quantity is shown:

- **Store in pcs.** All egg quantities are stored internally in pieces. Conversion to rak happens only at display time; the rounded form is never stored, so rounding can never compound across transactions.

- **Display as mixed 'X rak + Y pcs'.** For example 2,617 pcs displays as 87 rak + 7 pcs (87 × 30 = 2,610, remainder 7), matching how stock is physically counted. This applies to warehouse stock, sales lines, dashboard, and reports.

- **Entry stays flexible.** On entry forms a user may type a quantity in rak or in pcs; selling '2 rak' records exactly 60 pcs. The mixed format is a display convention, not an entry constraint.

## 2.5 Key Design Principles

- **Ease of Use First:** Data entry is optimised for speed; minimal taps per batch and per daily record. Collection stays single-number and Type-agnostic.

- **Batch-Sequential Grading Lock:** Grading must be completed per batch before the next batch (generalised Batch N requires Batch N-1, for any N).

- **Two-Dimensional Grading, Full SKU Matrix:** Every sellable egg carries a Size & Health grade and a Type grade; every active combination is a valid SKU.

- **Flock-Aware Operations:** A flock placed in a kandang anchors age, population, mortality, and production; daily recording, feed, and health all attach to the active placement.

- **Reconciled Single Source of Truth:** Egg buckets on the daily record derive from collection/grading; PAKAN MASUK derives from mixing; VAKSIN derives from the vaksin log. The same fact is never typed twice.

- **Mobile-Friendly:** Admins and grading staff can work on a tablet or smartphone.

- **Stakeholder Dashboard:** Owners view rich analytics without touching raw data or entry forms.

- **Configurable Structure & Master Data:** Farmhouses, warehouses, mapping, and buyers are Admin-managed; units, grade types, feed ingredients, OVK items, and vaksin types are Superadmin-managed — all without developer involvement.

- **Supervised Stock Corrections:** Manual egg-stock corrections are gated behind Admin, require a reason, and are logged as a distinct movement type.

- **Audit Trail:** Every entry is timestamped and attributed to the logged-in user; edits and corrections are logged against the original.

# 3. Functional Requirements

Requirements carried over from v1.3 retain their original Req IDs. IDs tagged **CHANGED** were modified for v2.0 (chiefly the Tray-to-Rak rename, Type capture, and Angkat Rak by Type). IDs tagged **NEW** are introduced in v2.0. Priorities follow MoSCoW (Must / Should / Could Have).

## 3.1 Module 1 — User Authentication & Access Control

All users authenticate before accessing any part of the system. Role-based permissions are enforced server-side across the three roles: Superadmin, Owner, Admin.

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>FR-01</strong></td>
<td>Must Have</td>
<td>Users must log in with a username and password. Unauthenticated access redirects to the login page.</td>
<td>Auth</td>
<td>Unauthenticated requests return login screen</td>
</tr>
<tr class="even">
<td><p><strong>FR-02</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>System supports exactly 3 roles: Superadmin (full access incl. user management, flock creation, and master data), Owner (read-only dashboard and reports), Admin (all operational work except user management, flock creation, and master data).</td>
<td>Auth</td>
<td>Each role sees only permitted menus; server-side enforcement confirmed</td>
</tr>
<tr class="odd">
<td><strong>FR-03</strong></td>
<td>Must Have</td>
<td>Superadmin can create, edit, and deactivate user accounts and assign roles. Admins and Owners cannot manage user accounts.</td>
<td>Auth</td>
<td>Deactivated users cannot log in; Admins cannot reach user-management screens</td>
</tr>
<tr class="even">
<td><strong>FR-04</strong></td>
<td>Must Have</td>
<td>Owner role is read-only. Any attempt to submit data entries, configuration, or stock adjustments is blocked server-side, not merely hidden in the UI.</td>
<td>Auth</td>
<td>Owner POST/PUT/DELETE return 403; Owner UI shows no entry forms</td>
</tr>
<tr class="odd">
<td><strong>FR-05</strong></td>
<td>Should Have</td>
<td>Sessions expire after a configurable idle period.</td>
<td>Auth</td>
<td>User is logged out after inactivity</td>
</tr>
</tbody>
</table>

## 3.2 Module 2 — Farmhouse Collection Input

Records the raw egg count per batch per kandang. Used by Admins and optimised for speed on mobile. Collection is Type-agnostic except for Angkat Rak, which is split by Type per lift.

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>FR-06</strong></td>
<td>Must Have</td>
<td>Admin selects a kandang and batch number to begin a collection entry for the current date. The batch selector shows all batch slots up to the kandang's configured maximum (default 2).</td>
<td>Collection</td>
<td>Active kandang listed; batch selector shows the correct number of slots per kandang</td>
</tr>
<tr class="even">
<td><strong>FR-07</strong></td>
<td>Must Have</td>
<td>Collection entry records Good Eggs, Telur Retak, Telur Lunak, and Telur Kosong, all in pcs and Type-agnostic.</td>
<td>Collection</td>
<td>All four fields saved with timestamp and user</td>
</tr>
<tr class="odd">
<td><p><strong>FR-08</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>Admin can record Angkat Rak for the batch, split by Grade by Type. Each lift captures a quantity per Type (e.g. Normal and Omega); the Omega field is hidden/zero until used. A single lift may contain both Types. These quantities bypass grading and flow to the assigned warehouse on save.</td>
<td>Collection</td>
<td>Per-Type Angkat Rak fields shown; each Type quantity flows to warehouse stock as its own SKU on save</td>
</tr>
<tr class="even">
<td><strong>FR-09</strong></td>
<td>Must Have</td>
<td>System prevents duplicate entries for the same kandang, date, and batch number; an edit mode opens the existing entry instead.</td>
<td>Collection</td>
<td>Duplicate attempt shows warning and opens existing entry</td>
</tr>
<tr class="odd">
<td><strong>FR-10</strong></td>
<td>Must Have</td>
<td>Admin can view and edit previously submitted collection records. Edits are logged with editor name and timestamp.</td>
<td>Collection</td>
<td>Audit log entry created on edit</td>
</tr>
<tr class="even">
<td><strong>FR-11</strong></td>
<td>Should Have</td>
<td>A daily overview shows all kandang and their batch completion status for today, based on each kandang's configured max batches.</td>
<td>Collection</td>
<td>Correct status per batch per kandang</td>
</tr>
<tr class="odd">
<td><strong>FR-12</strong></td>
<td>Should Have</td>
<td>Input forms auto-focus the first numeric field and trigger a numeric keypad on mobile.</td>
<td>Collection</td>
<td>Numeric keyboard appears on mobile without extra tap</td>
</tr>
<tr class="even">
<td><strong>FR-13</strong></td>
<td>Could Have</td>
<td>Admin can add a free-text remark per batch.</td>
<td>Collection</td>
<td>Remark stored and visible in batch detail and reports</td>
</tr>
</tbody>
</table>

## 3.3 Module 3 — Grading Process Input

Each batch is graded centrally and sequentially. Grading captures both Size & Health grade and Type grade, with Type entered via tabs reflecting the farm's physical Omega/Normal separation.

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>FR-14</strong></td>
<td>Must Have</td>
<td>Admin selects a kandang, date, and batch to grade. Only batches with a completed collection entry and no completed grading entry are available.</td>
<td>Grading</td>
<td>Batches without collection, or already graded, are locked</td>
</tr>
<tr class="even">
<td><strong>FR-15</strong></td>
<td>Must Have</td>
<td>System enforces batch-sequential grading: Batch N+1 grading cannot start until Batch N grading is submitted, for any N for that kandang.</td>
<td>Grading</td>
<td>Next batch grading is disabled until the previous batch is submitted</td>
</tr>
<tr class="odd">
<td><p><strong>FR-16</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>The grading form is organised by Grade by Type tabs (Normal, Omega, and any Superadmin-configured types). Under each Type tab the grader enters quantities across the Size &amp; Health grades: A++, A+, A, B, C, Telur Kecil, Telur Mini, Telur Retak, Telur Plastik, Telur Lunak. Each entered lot therefore forms an Egg SKU (Size &amp; Health × Type).</td>
<td>Grading</td>
<td>All Size &amp; Health grades available under each configured Type tab; every saved lot carries both dimensions</td>
</tr>
<tr class="even">
<td><p><strong>FR-17</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>Grade A++ through Telur Retak are entered in rak; Telur Plastik and Telur Lunak are entered in pcs. The system auto-calculates pcs from rak entries as a reference (1 rak = 30 pcs).</td>
<td>Grading</td>
<td>Plastik and Lunak fields are pcs-only; others show rak input with pcs reference</td>
</tr>
<tr class="odd">
<td><p><strong>FR-18</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>A live running total of graded pcs (summed across all Type tabs, including Lunak and Plastik) is shown against available pcs (Good Eggs from collection minus total Angkat Rak across Types). A warning appears if the graded total exceeds available quantity.</td>
<td>Grading</td>
<td>Counter updates on each change across tabs; over-entry highlighted in red</td>
</tr>
<tr class="even">
<td><strong>FR-19</strong></td>
<td>Must Have</td>
<td>Grading is submitted as a whole. Partial work is kept as a server-side draft and does not affect warehouse stock until submitted.</td>
<td>Grading</td>
<td>Draft does not update stock; submission updates stock per Egg SKU</td>
</tr>
<tr class="odd">
<td><strong>FR-20</strong></td>
<td>Should Have</td>
<td>Admin can add a free-text remark per grading session.</td>
<td>Grading</td>
<td>Remark stored and visible in grading detail and reports</td>
</tr>
<tr class="even">
<td><strong>FR-21</strong></td>
<td>Could Have</td>
<td>Admin can configure whether grading-stage Telur Retak is tracked separately from collection-stage Retak in reports.</td>
<td>Grading</td>
<td>Configuration toggle available</td>
</tr>
</tbody>
</table>

> **v2.0.1 (as-built) — same-WITA-day grading, collection lock & Superadmin override.** A grading record is tied to its collection's production business day (same kandang/date/batch). Once a batch's grading is SUBMITTED its collection counts are **LOCKED** (a plain edit is rejected); a **Superadmin may override** to correct the collection, but the edit is refused if it would strand the graded total over the new available, and the compensating Angkat Rak movements carry an audit reason. The override never re-dates grading or splits a batch's stock across dates — attribution stays on the production day. Grading is **edit-after-submit** (re-submit reconciles stock by delta). (Assumptions A11, A12 → A27.)

## 3.4 Module 4 — Warehouse Management

Graded eggs and Angkat Rak are routed to the assigned warehouse per the farmhouse-to-warehouse mapping. Stock is tracked per Egg SKU in pcs and displayed in rak + pcs.

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>FR-22</strong></td>
<td>Must Have</td>
<td>On grading submission, graded quantities are added to the assigned warehouse's stock per Egg SKU (Size &amp; Health × Type).</td>
<td>Warehouse</td>
<td>Warehouse stock increases correctly per Egg SKU on submission</td>
</tr>
<tr class="even">
<td><p><strong>FR-23</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>Angkat Rak quantities from collection are routed to the assigned warehouse on collection submission (not held for grading). Each Angkat Rak lift posts to stock per Type as the Egg SKU 'Angkat Rak / &lt;Type&gt;'.</td>
<td>Warehouse</td>
<td>Angkat Rak immediately reflected in warehouse stock as a per-Type SKU</td>
</tr>
<tr class="odd">
<td><p><strong>FR-24</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>Admins can view current stock per Egg SKU per warehouse, displayed in both rak and pcs (mixed 'X rak + Y pcs'), grouped by Size &amp; Health grade with Type grade sub-columns.</td>
<td>Warehouse</td>
<td>Stock table shows rak + pcs side by side, grouped by grade with Type sub-columns</td>
</tr>
<tr class="even">
<td><strong>FR-25</strong></td>
<td>Must Have</td>
<td>System maintains a full ledger of all incoming and outgoing stock movements per warehouse, including source kandang, batch, Egg SKU, quantity, date, and user.</td>
<td>Warehouse</td>
<td>Ledger accessible with date and warehouse filters</td>
</tr>
<tr class="odd">
<td><strong>FR-26</strong></td>
<td>Must Have</td>
<td>Admin can submit a Stock Correction (warehouse + Egg SKU, corrected quantity or delta, mandatory reason of 20+ characters, optional reference). Corrections are logged as movement type 'Correction' and visible to Superadmin in an audit view.</td>
<td>Warehouse</td>
<td>Correction flagged in ledger with reason; stock updated immediately; visible in audit view</td>
</tr>
<tr class="even">
<td><strong>FR-27</strong></td>
<td>Should Have</td>
<td>System raises an alert when any Egg SKU in a warehouse drops below a configurable minimum threshold.</td>
<td>Warehouse</td>
<td>Alert visible on dashboard and warehouse view</td>
</tr>
</tbody>
</table>

## 3.5 Module 5 — Sales & Dispatch

Eggs leaving a warehouse are recorded as a sales transaction against a pre-registered buyer, at the Egg SKU level, in the rak/pcs system.

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>FR-28</strong></td>
<td>Must Have</td>
<td>Admin creates a sales transaction by selecting warehouse, buyer (from the pre-registered list), and date.</td>
<td>Sales</td>
<td>Transaction header saved with warehouse, buyer, date, and staff</td>
</tr>
<tr class="even">
<td><p><strong>FR-29</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>A transaction supports multiple line items, each an Egg SKU (Size &amp; Health × Type) with quantity and unit (rak or pcs). All Egg SKUs are available per row.</td>
<td>Sales</td>
<td>Multi-row line-item form; all SKU combinations available</td>
</tr>
<tr class="odd">
<td><strong>FR-30</strong></td>
<td>Must Have</td>
<td>On submission, each line item's quantity is deducted from warehouse stock per Egg SKU. If any line exceeds stock, the whole transaction is blocked with an error naming the short SKU.</td>
<td>Sales</td>
<td>Stock deducted atomically; no partial deduction</td>
</tr>
<tr class="even">
<td><strong>FR-31</strong></td>
<td>Must Have</td>
<td>Each submitted transaction generates a ledger entry per line item, linked to transaction ID, buyer, and warehouse.</td>
<td>Sales</td>
<td>Ledger entries reference transaction ID and buyer</td>
</tr>
<tr class="odd">
<td><strong>FR-32</strong></td>
<td>Must Have</td>
<td>Admin can view and search transactions, filterable by date range, buyer, warehouse, and Egg SKU.</td>
<td>Sales</td>
<td>Search/filter returns correct results within 2 seconds</td>
</tr>
<tr class="even">
<td><strong>FR-33</strong></td>
<td>Should Have</td>
<td>A transaction can be voided by an Admin with a mandatory reason; voiding reverses stock and marks ledger entries voided.</td>
<td>Sales</td>
<td>Stock restored on void; voided transactions excluded from sales reports by default</td>
</tr>
<tr class="odd">
<td><p><strong>FR-34</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Should Have</td>
<td>A running total (rak and pcs) is shown as line items are added, before submission.</td>
<td>Sales</td>
<td>Live total updates as rows change</td>
</tr>
<tr class="even">
<td><strong>FR-35</strong></td>
<td>Could Have</td>
<td>Admin can add a free-text note per transaction.</td>
<td>Sales</td>
<td>Note stored and visible in transaction detail</td>
</tr>
</tbody>
</table>

## 3.6 Module 6 — Buyer Management

| **Req ID** | **Priority** | **Description**                                                                                                      | **Module** | **Acceptance Criteria**                                    |
|------------|--------------|----------------------------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------|
| **FR-36**  | Must Have    | Admin can add a buyer with name and status (Active/Inactive).                                                        | Buyers     | New buyer immediately available in the sales dropdown      |
| **FR-37**  | Must Have    | Admin can edit a buyer's name.                                                                                       | Buyers     | Updated name reflected across historical transaction views |
| **FR-38**  | Must Have    | Admin can deactivate a buyer; deactivated buyers do not appear in new transactions but historical data is preserved. | Buyers     | Deactivated flag set; historical data intact               |
| **FR-39**  | Should Have  | Admin can view a buyer profile: name, total transactions, total eggs purchased by Egg SKU, and purchase history.     | Buyers     | Buyer profile renders correct aggregates per Egg SKU       |

## 3.7 Module 7 — Configuration & Master Data

Operational structure (farmhouses, warehouses, mapping, buyers) is Admin-managed. **Master/catalog data — measurement units, Grade by Type values, feed ingredients, OVK items, and vaksin types — is Superadmin-managed**. None of this requires code changes or restarts.

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>FR-40</strong></td>
<td>Must Have</td>
<td>Admin can add a farmhouse with name, code, status, assigned warehouse, and max batches per day (default 2, min 1, max configurable).</td>
<td>Config</td>
<td>New farmhouse appears in dropdowns immediately; batch slots reflect the configured max</td>
</tr>
<tr class="even">
<td><strong>FR-41</strong></td>
<td>Must Have</td>
<td>Admin can edit a farmhouse's name, code, warehouse assignment, or max batch count. Mapping changes are date-effective and logged; max-batch changes take effect the next day.</td>
<td>Config</td>
<td>Historical data stays linked to original warehouse; future entries use new mapping; change logged</td>
</tr>
<tr class="odd">
<td><strong>FR-42</strong></td>
<td>Must Have</td>
<td>Admin can deactivate a farmhouse; deactivated farmhouses are excluded from new entries but retain history.</td>
<td>Config</td>
<td>Deactivated flag set; no data deleted</td>
</tr>
<tr class="even">
<td><strong>FR-43</strong></td>
<td>Must Have</td>
<td>Admin can add, rename, or deactivate warehouses.</td>
<td>Config</td>
<td>Deactivated warehouses excluded from new mappings</td>
</tr>
<tr class="odd">
<td><strong>FR-44</strong></td>
<td>Must Have</td>
<td>Admin can configure farmhouse-to-warehouse mapping (many kandang to one warehouse).</td>
<td>Config</td>
<td>Mapping change is date-stamped and logged</td>
</tr>
<tr class="even">
<td><p><strong>FR-45</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>Superadmin can add, rename, or deactivate Grade by Type values (e.g. add 'Kampung Egg'). Deactivated types are excluded from new grading/sales but preserved historically. Adding a Type extends the valid SKU matrix automatically.</td>
<td>Config</td>
<td>New type appears in grading and sales immediately; deactivated types excluded from new entries</td>
</tr>
<tr class="odd">
<td><p><strong>FR-46</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>Superadmin can configure measurement units (e.g. add 'crate' with its pcs equivalent). The base rak (30 pcs) and pcs units are always present.</td>
<td>Config</td>
<td>New unit appears across entry forms and reports</td>
</tr>
<tr class="even">
<td><strong>FR-47</strong></td>
<td>Should Have</td>
<td>Admin can configure low-stock thresholds per Egg SKU per warehouse.</td>
<td>Config</td>
<td>Alerts trigger at configured thresholds</td>
</tr>
<tr class="odd">
<td><p><strong>FR-48</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Could Have</td>
<td>Superadmin can configure Grade by Size &amp; Health display names and sort order.</td>
<td>Config</td>
<td>Grade labels update across all screens</td>
</tr>
</tbody>
</table>

## 3.8 Module 8 — Dashboard & Analytics

The dashboard is the Owner's sole interface: read-only, at-a-glance. Admin can also view it. Egg quantities are shown in rak + pcs. Flock-health KPIs derive from the daily recording layer (Module 10).

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>FR-49</strong></td>
<td>Must Have</td>
<td>Dashboard shows total daily egg production (Good Eggs) across all kandang for the current day and a selectable range, as a line or bar chart.</td>
<td>Dashboard</td>
<td>Chart renders with date axis; values correct</td>
</tr>
<tr class="even">
<td><strong>FR-50</strong></td>
<td>Must Have</td>
<td>Dashboard shows cracked egg percentage (Retak + Lunak vs. total collected) per day and per kandang.</td>
<td>Dashboard</td>
<td>Percentage shown; colour-coded above threshold</td>
</tr>
<tr class="odd">
<td><strong>FR-51</strong></td>
<td>Must Have</td>
<td>Dashboard shows Telur Kosong count per day and per kandang as a hen-productivity indicator.</td>
<td>Dashboard</td>
<td>Kosong trend chart available</td>
</tr>
<tr class="even">
<td><strong>FR-52</strong></td>
<td>Must Have</td>
<td>Dashboard shows grade distribution by Size &amp; Health as a proportion chart, with a secondary Type breakdown (Omega vs Normal).</td>
<td>Dashboard</td>
<td>Charts rendered for both dimensions</td>
</tr>
<tr class="odd">
<td><p><strong>FR-53</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>Dashboard shows current warehouse stock per Egg SKU per warehouse in rak and pcs.</td>
<td>Dashboard</td>
<td>Stock summary per warehouse, grouped by Size &amp; Health with Type sub-columns</td>
</tr>
<tr class="even">
<td><p><strong>FR-54</strong></p>
<p><strong>CHANGED</strong></p></td>
<td>Must Have</td>
<td>Dashboard includes a Sales Summary (eggs sold in rak and pcs) by day and week, broken down by Egg SKU.</td>
<td>Dashboard</td>
<td>Daily and weekly sales charts rendered</td>
</tr>
<tr class="odd">
<td><strong>FR-55</strong></td>
<td>Should Have</td>
<td>Owner/Admin can filter the dashboard by date range, kandang, warehouse, and Type grade; all charts update.</td>
<td>Dashboard</td>
<td>Filter controls present; all charts respond</td>
</tr>
<tr class="even">
<td><strong>FR-56</strong></td>
<td>Should Have</td>
<td>Dashboard shows per-kandang production comparison across the period.</td>
<td>Dashboard</td>
<td>Each kandang represented as a series</td>
</tr>
<tr class="odd">
<td><strong>FR-57</strong></td>
<td>Should Have</td>
<td>Dashboard shows Angkat Rak volume as a separate metric.</td>
<td>Dashboard</td>
<td>Angkat Rak clearly labelled in charts and tables</td>
</tr>
<tr class="even">
<td><strong>FR-58</strong></td>
<td>Should Have</td>
<td>All dashboard data can be exported to Excel/CSV.</td>
<td>Dashboard</td>
<td>Download triggers file export</td>
</tr>
<tr class="odd">
<td><strong>FR-59</strong></td>
<td>Could Have</td>
<td>System generates and distributes a daily summary report (PDF or email) at a configurable time.</td>
<td>Dashboard</td>
<td>Scheduled report delivered at configured time</td>
</tr>
</tbody>
</table>

## 3.9 Module 9 — Flock Management & Lifecycle

A flock is one chick-in delivery (one strain, one chick-in date, one placement age) that may populate one or more kandang as separate placements. Flock creation and lifecycle are Superadmin actions; day-to-day recording against a placement is Admin work (Module 10).

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p><strong>FR-60</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Superadmin can create a flock by recording: strain, chick-in date, and placement age in days at chick-in (e.g. 113). One flock can be assigned to one or more kandang; each assignment is a placement with its own initial population (Populasi Awal).</td>
<td>Flock</td>
<td>Flock created with shared strain/date/age; one or more placements created, each with its own Populasi Awal</td>
</tr>
<tr class="even">
<td><p><strong>FR-61</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>A placement requires a free (non-occupied) kandang. A kandang may hold only one active placement at a time. Attempting to place into an occupied kandang is blocked.</td>
<td>Flock</td>
<td>Occupied kandang rejected for new placement</td>
</tr>
<tr class="odd">
<td><p><strong>FR-62</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>For each active placement the system derives flock age in days (HARI = placement age + days since chick-in) and weeks (MINGGU = HARI / 7), shared across all kandang of the flock.</td>
<td>Flock</td>
<td>HARI and MINGGU computed correctly per day for each placement</td>
</tr>
<tr class="even">
<td><p><strong>FR-63</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>The system maintains a running live-hen count (HIDUP) per placement = previous day's HIDUP minus that day's MATI and AFKIR, seeded from Populasi Awal on the chick-in date.</td>
<td>Flock</td>
<td>HIDUP correct across a multi-day sequence including deaths and culls</td>
</tr>
<tr class="odd">
<td><p><strong>FR-64</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Superadmin can end a placement (flock fully culled/sold out of that kandang), setting an end date. Ending all placements ends the flock. An ended placement frees the kandang for a future chick-in.</td>
<td>Flock</td>
<td>Ended placement frees the kandang; flock ends when all placements end</td>
</tr>
<tr class="even">
<td><p><strong>FR-65</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>All flock, placement, and daily history is retained after a placement ends; a new placement in the same kandang starts a fresh age/population/HD lineage without affecting prior history.</td>
<td>Flock</td>
<td>Prior flock data intact; new placement starts clean</td>
</tr>
<tr class="odd">
<td><p><strong>FR-66</strong></p>
<p><strong>NEW</strong></p></td>
<td>Should Have</td>
<td>Superadmin can edit flock attributes (strain, chick-in date, placement age, Populasi Awal) with changes logged; downstream derived values recompute.</td>
<td>Flock</td>
<td>Edits logged; HARI/HIDUP recompute consistently</td>
</tr>
</tbody>
</table>

> **v2.0.1 (as-built) — flock derivations & lifecycle.** Business day = **Asia/Makassar (WITA, UTC+8, no DST)** throughout (`src/lib/dates.ts`). **MINGGU = ceil(HARI / 7)** (confirmed farm fact: day-120 = week 18, day-119 = week 17) — refines the "MINGGU = HARI / 7" above. **HIDUP** is persisted write-once as a `HidupSnapshot` per placement-day (never recomputed); **day-0 (chick-in-day) mortality is recordable** and nets off Populasi Awal. One active placement per kandang is enforced in-service *and* by a raw-SQL partial unique index. A Superadmin-only **Populasi Awal correction** re-bases the whole HIDUP history by the delta (the one edit for a chick-in typo); flock header/placements are otherwise fixed. (Assumptions A6, A19, A21, A22, A23, A28.)

## 3.10 Module 10 — Daily Farmhouse Recording

One record per kandang per day for the active placement. Admin enters a small set of yellow fields; the system derives the rest from the flock layer, the collection/grading flow, the mixing event, and the vaksin log. The egg buckets derive from collection for a live same-day figure and reconcile to grading once grading is complete.

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p><strong>FR-67</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Admin opens the daily record for a kandang and date; the system resolves the active placement and pre-loads all derived fields. Duplicate records for the same kandang/date are prevented (edit mode instead).</td>
<td>Daily Rec</td>
<td>One record per kandang/date; derived fields pre-loaded</td>
</tr>
<tr class="even">
<td><p><strong>FR-68</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Admin inputs MATI (deaths) and AFKIR (culls) in head count. The system updates HIDUP for the day and forward.</td>
<td>Daily Rec</td>
<td>HIDUP reflects MATI/AFKIR immediately and for subsequent days</td>
</tr>
<tr class="odd">
<td><p><strong>FR-69</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>The system derives and displays HARI, MINGGU, and HIDUP for the record (read-only).</td>
<td>Daily Rec</td>
<td>Derived flock fields correct and read-only</td>
</tr>
<tr class="even">
<td><p><strong>FR-70</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>The system derives the four egg buckets for the day from collection (live) and reconciles to grading when complete: Telur Utuh (clean grades A++..Mini + Angkat Rak), Telur Lunak, Telur Pecah (Retak + Plastik), Telur Kosong. The day's total egg count is stable from collection; only the Pecah sub-split (Retak vs Plastik) firms up after grading.</td>
<td>Daily Rec</td>
<td>Buckets populate from collection same-day; reconcile to grading; daily total unchanged by reconciliation</td>
</tr>
<tr class="odd">
<td><p><strong>FR-71</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>HD% (hen-day percentage) is derived = (Utuh + Lunak + Pecah + Kosong) / HIDUP x 100, using all eggs laid. The daily record is Type-agnostic.</td>
<td>Daily Rec</td>
<td>HD% matches the all-eggs formula on sample data</td>
</tr>
<tr class="even">
<td><p><strong>FR-72</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>The system presents a four-column PAKAN block: PAKAN MASUK (fresh netted mix, derived from the mixing event), PAKAN TERSEDIA (MASUK + yesterday's reusable leftover), SISA DIGUNAKAN (Admin input, reusable leftover), and SISA DIBUANG (Admin input, discarded leftover).</td>
<td>Daily Rec</td>
<td>Four PAKAN columns present; MASUK and TERSEDIA derived; SISA fields editable</td>
</tr>
<tr class="odd">
<td><p><strong>FR-73</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>The system derives REALISASI INTAKE = PAKAN TERSEDIA - (SISA DIGUNAKAN + SISA DIBUANG) and GRAM/EKOR = REALISASI INTAKE / HIDUP x 1000.</td>
<td>Daily Rec</td>
<td>Intake and gram/ekor computed correctly</td>
</tr>
<tr class="even">
<td><p><strong>FR-74</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Admin inputs BERAT TELUR (total egg mass for the day, kg, global daily figure). The system derives daily FCR = REALISASI INTAKE / BERAT TELUR.</td>
<td>Daily Rec</td>
<td>FCR computed daily from intake and egg mass</td>
</tr>
<tr class="odd">
<td><p><strong>FR-75</strong></p>
<p><strong>NEW</strong></p></td>
<td>Should Have</td>
<td>Admin inputs BERAT BADAN (sampled body weight) on a periodic (weekly) basis; on non-sampling days the field is optional. For v2.0 it is recorded only (no automated analysis).</td>
<td>Daily Rec</td>
<td>Body weight recorded when entered; not required daily</td>
</tr>
<tr class="even">
<td><p><strong>FR-76</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>The JENIS (feed) field is derived from the day's mixing event and shows the recipe's ingredient list (konsentrat/finished feed and premix first, then jagung, then dedak), e.g. 'DKLS-36 + Maximus-Egg + Jagung + Dedak'.</td>
<td>Daily Rec</td>
<td>JENIS reflects the mixing recipe for the consumption day</td>
</tr>
<tr class="odd">
<td><p><strong>FR-77</strong></p>
<p><strong>NEW</strong></p></td>
<td>Should Have</td>
<td>The VAKSIN field is derived from the vaksin log for that kandang/date (Module 13); it is not typed on the daily record.</td>
<td>Daily Rec</td>
<td>VAKSIN column shows logged vaccinations for the date</td>
</tr>
<tr class="even">
<td><p><strong>FR-78</strong></p>
<p><strong>NEW</strong></p></td>
<td>Should Have</td>
<td>Admin can input OBAT and VITAMIN administration notes (which treatment was given to the hens that day) as free reference to OVK items. These are notes only and do not affect OVK stock (stock moves on transfer, Module 12). Chemicals are not recorded here.</td>
<td>Daily Rec</td>
<td>OBAT/VITAMIN notes stored; no OVK stock change triggered</td>
</tr>
<tr class="odd">
<td><p><strong>FR-79</strong></p>
<p><strong>NEW</strong></p></td>
<td>Could Have</td>
<td>Admin can add a free-text KETERANGAN remark per daily record (e.g. lampu nyala 5 jam, power cut).</td>
<td>Daily Rec</td>
<td>Remark stored and visible in the daily record and reports</td>
</tr>
</tbody>
</table>

> **v2.0.1 (as-built) — write-once vs live-derived.** Frozen at record creation (§5.3): HIDUP, HD%, MATI/AFKIR, and — once the day's mix exists — the PAKAN block (MASUK/TERSEDIA/REALISASI INTAKE/GRAM-EKOR/FCR/JENIS). Live-derived on read, not stored: the four egg buckets, and the **VAKSIN field** (FR-101, read from the vaksin log). PAKAN MASUK posts write-once from the mixing event (first-write-wins: at record creation if the mix exists, else at mix confirmation). (Assumptions A24, A26, A37.)

## 3.11 Module 11 — PAKAN (Feed) Management & Mixing

PAKAN covers a single central raw-ingredient store, per-kandang daily mixing recipes, a printable ingredient pull-list for the feed warehouse, and automatic posting of the mixed amount into the daily record. A mixing event is performed the evening before but is dated to the consumption day, so recipe, daily record, and ingredient drawdown all share one date.

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p><strong>FR-80</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Superadmin maintains a feed-ingredient master: name, category (e.g. Konsentrat / Finished Feed, Premix / Supplement, Grain/Jagung, Bran/Dedak), base unit, and optional unit conversions (e.g. 1 karung = N kg). Admins reference ingredients but cannot edit the master.</td>
<td>PAKAN</td>
<td>Ingredient master managed by Superadmin; used across mixing and delivery</td>
</tr>
<tr class="even">
<td><p><strong>FR-81</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Admin records a feed delivery (date, ingredient, quantity in a defined unit) which increases central raw-ingredient stock.</td>
<td>PAKAN</td>
<td>Delivery increases central ingredient stock in base unit</td>
</tr>
<tr class="odd">
<td><p><strong>FR-82</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Admin sets a mixing recipe per kandang for a consumption day. The system computes the requirement TOTAL = current placement population (HIDUP) x projected intake (g/bird, Admin input per kandang) / 1000.</td>
<td>PAKAN</td>
<td>Requirement TOTAL computed from population x projected intake</td>
</tr>
<tr class="even">
<td><p><strong>FR-83</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>The system shows the kandang's reusable leftover (yesterday's SISA DIGUNAKAN) and nets the fresh mix: TOTAL CAMPUR (fresh mix) = requirement TOTAL - reusable leftover, floored at 0. TOTAL CAMPUR becomes PAKAN MASUK for the consumption-day record; PAKAN TERSEDIA = PAKAN MASUK + reusable leftover.</td>
<td>PAKAN</td>
<td>Fresh mix netted by leftover and floored at 0; MASUK and TERSEDIA posted to the daily record</td>
</tr>
<tr class="odd">
<td><p><strong>FR-84</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Recipe main feeds are entered by percentage (summing to 100%); their weights derive as percentage x TOTAL CAMPUR (the netted fresh mix). Supplements/premix are entered as fixed weights and are not auto-scaled by netting.</td>
<td>PAKAN</td>
<td>Main-feed weights = % x fresh mix; supplement weights taken as entered</td>
</tr>
<tr class="even">
<td><p><strong>FR-85</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>On confirmation, the mixing event draws down each ingredient's central stock by its computed/entered weight.</td>
<td>PAKAN</td>
<td>Central ingredient stock reduced per recipe line on confirmation</td>
</tr>
<tr class="odd">
<td><p><strong>FR-86</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>The system produces a printable per-kandang ingredient pull-list (recipe lines with weights and units) for the feed warehouse, suitable for printing and hand-off.</td>
<td>PAKAN</td>
<td>Pull-list prints per kandang with ingredient weights</td>
</tr>
<tr class="even">
<td><p><strong>FR-87</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Each day's recipe is logged as its own dated record (dated to the consumption day). For speed, the recipe pre-fills from the previous day's recipe for that kandang; the Admin tweaks percentages/ingredients and confirms.</td>
<td>PAKAN</td>
<td>Recipe logged per consumption day; pre-filled from prior day</td>
</tr>
<tr class="odd">
<td><p><strong>FR-87b</strong></p>
<p><strong>NEW</strong></p></td>
<td>Should Have</td>
<td>Finished-feed ('pakan jadi') kandang are supported as a recipe with a single 100% main feed plus optional premix; JENIS then shows the finished feed (+ premix).</td>
<td>PAKAN</td>
<td>Finished-feed recipe behaves as a 100% single main with optional premix</td>
</tr>
<tr class="even">
<td><p><strong>FR-88</strong></p>
<p><strong>NEW</strong></p></td>
<td>Should Have</td>
<td>System warns if a mixing confirmation would drive any ingredient's central stock below zero.</td>
<td>PAKAN</td>
<td>Negative-stock mix flagged before confirmation</td>
</tr>
<tr class="odd">
<td><p><strong>FR-89</strong></p>
<p><strong>NEW</strong></p></td>
<td>Should Have</td>
<td>Admin can view current central ingredient stock levels and a feed-delivery history.</td>
<td>PAKAN</td>
<td>Ingredient stock and delivery history viewable</td>
</tr>
<tr class="even">
<td><p><strong>FR-90</strong></p>
<p><strong>NEW</strong></p></td>
<td>Could Have</td>
<td>Projected intake (g/bird) per kandang is retained per day to support later feed-efficiency analytics.</td>
<td>PAKAN</td>
<td>Projected intake stored per kandang per day</td>
</tr>
</tbody>
</table>

> **v2.0.1 (as-built) — feed stock ledger & mixing.** Central ingredient stock moves through **`ingredientLedger.ts` only** (append-only `IngredientMovement` + `IngredientStock` balance; kg Decimal; FOR-UPDATE-locked; reject-negative) — the feed mirror of the egg ledger, including a supervised **CORRECTION** (pre/post + reason ≥ 20). Mixing is **confirm-once** per kandang/day; a **no-mix day** (leftover ≥ requirement → TOTAL CAMPUR 0) draws nothing; main-feed % must sum to 100% (±0.01); the requirement uses the latest HIDUP snapshot ≤ the consumption day. Feed entries are kg — the per-item unit-conversion mechanism exists (OVK) but isn't wired to feed yet. (Assumptions A31, A32, A33, A34, A35, A36.)

## 3.12 Module 12 — OVK (Obat / Vitamin / Chemical) Inventory

OVK is a single inventory of three categories — Obat, Vitamin, Chemical — held in one central office store. Stock increases on delivery to the office and decreases when items are transferred out to a kandang (the transfer is the stock-reduction moment, not the later administration to hens). The usage report mirrors the farm's 'Catatan Pemakaian Obat' sheet.

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p><strong>FR-91</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Superadmin maintains an OVK item master: name, category (Obat / Vitamin / Chemical), base unit, and optional per-item unit conversions where relevant (e.g. 1 botol = 1 liter; 1 pcs = 100 gram). Items needing no conversion simply carry their own unit (e.g. box).</td>
<td>OVK</td>
<td>OVK master managed by Superadmin with per-item units/conversions</td>
</tr>
<tr class="even">
<td><p><strong>FR-92</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Admin records an OVK delivery (date, item, quantity, unit) increasing central office stock.</td>
<td>OVK</td>
<td>Delivery increases office stock in base unit</td>
</tr>
<tr class="odd">
<td><p><strong>FR-93</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Admin records an office-to-kandang transfer (date, item, quantity, unit, kandang, optional note). This decreases office stock at the moment of transfer.</td>
<td>OVK</td>
<td>Transfer reduces office stock immediately; attributed to a kandang</td>
</tr>
<tr class="even">
<td><p><strong>FR-94</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Transfers are independent of the daily-record OBAT/VITAMIN notes; the same item is not double-counted (notes do not move stock).</td>
<td>OVK</td>
<td>Daily notes do not alter OVK stock; only transfers do</td>
</tr>
<tr class="odd">
<td><p><strong>FR-95</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>The system produces an OVK Usage (Pemakaian) Report grouped by kandang over a date range, with columns: date, item name, quantity out, unit, and note.</td>
<td>OVK</td>
<td>Report matches the per-kandang pemakaian layout</td>
</tr>
<tr class="even">
<td><p><strong>FR-96</strong></p>
<p><strong>NEW</strong></p></td>
<td>Should Have</td>
<td>Admin can view current office stock per OVK item and a delivery/transfer history.</td>
<td>OVK</td>
<td>Office stock and movement history viewable</td>
</tr>
<tr class="odd">
<td><p><strong>FR-97</strong></p>
<p><strong>NEW</strong></p></td>
<td>Should Have</td>
<td>System warns if a transfer would drive an item's office stock below zero.</td>
<td>OVK</td>
<td>Negative-stock transfer flagged</td>
</tr>
<tr class="even">
<td><p><strong>FR-98</strong></p>
<p><strong>NEW</strong></p></td>
<td>Could Have</td>
<td>OVK items can be deactivated; deactivated items are excluded from new movements but retain history.</td>
<td>OVK</td>
<td>Deactivated items excluded from new entries; history intact</td>
</tr>
</tbody>
</table>

> **v2.0.1 (as-built) — one office-stock ledger.** OVK office stock moves through **`ovkLedger.ts` only**: delivery IN, office→kandang transfer OUT, and a supervised **CORRECTION** are one append-only `OvkMovement` ledger + `OvkStock` balance (base-unit Decimal; reject-negative) — realizing the SRS's separate OVK Delivery / Transfer as movements. Per-item **unit conversions** (`OvkUnitConversion`, e.g. botol↔liter, pcs↔gram); the pemakaian report shows the entered quantity + unit. (Assumptions A38, A39, A40.)

## 3.13 Module 13 — VAKSIN Logging

Vaccination is recorded as a simple activity log with no inventory. The daily record's VAKSIN field derives from this log.

<table style="width:100%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 10%" />
<col style="width: 46%" />
<col style="width: 10%" />
<col style="width: 22%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Req ID</strong></th>
<th><strong>Priority</strong></th>
<th><strong>Description</strong></th>
<th><strong>Module</strong></th>
<th><strong>Acceptance Criteria</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p><strong>FR-99</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Superadmin maintains a vaksin-type master (name, status).</td>
<td>VAKSIN</td>
<td>Vaksin types managed by Superadmin</td>
</tr>
<tr class="even">
<td><p><strong>FR-100</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>Admin records a vaccination event: date, vaksin type, number of vials, kandang, and vaccinator (person who administered).</td>
<td>VAKSIN</td>
<td>Vaccination event saved with all five fields</td>
</tr>
<tr class="odd">
<td><p><strong>FR-101</strong></p>
<p><strong>NEW</strong></p></td>
<td>Must Have</td>
<td>The daily farmhouse record's VAKSIN field derives from the vaksin log for that kandang/date (single source of truth).</td>
<td>VAKSIN</td>
<td>Daily VAKSIN field reflects the log</td>
</tr>
<tr class="even">
<td><p><strong>FR-102</strong></p>
<p><strong>NEW</strong></p></td>
<td>Should Have</td>
<td>Admin can view and filter the vaksin log by date range, kandang, vaksin type, and vaccinator.</td>
<td>VAKSIN</td>
<td>Log filterable and viewable</td>
</tr>
</tbody>
</table>

# 4. Non-Functional Requirements

## 4.1 Usability

- A daily collection entry for one batch must be completable in under 90 seconds on a mobile device. The Angkat Rak Omega field stays hidden until needed so an all-Normal lift remains a single number.

- A grading entry for one batch must be completable in under 3 minutes once counts are known, including switching between Type tabs.

- A daily farmhouse record must be completable in under 90 seconds, since most fields are derived and only a handful are typed.

- All primary actions (new entry, view stock, view dashboard) must be reachable within 2 taps/clicks from the home screen.

- The interface must support Bahasa Indonesia as a language option (minimum), with English as default.

- All entry forms must be fully usable on a 5-inch smartphone screen without horizontal scrolling, including the Type-tab grading form and the four-column PAKAN block.

- The Owner home screen lands directly on the Dashboard; no entry or configuration screens are ever visible to the Owner role.

## 4.2 Performance

- Dashboard charts must render within 3 seconds for date ranges up to 12 months of data.

- Data entry save operations must complete within 1 second under normal network conditions.

- The system must support at least 20 concurrent users without performance degradation.

- Mixing-event computation and pull-list generation for a kandang must complete within 2 seconds.

## 4.3 Reliability & Availability

- System targets 99.5% uptime during operational hours (05:00 - 22:00 local time).

- All submitted data must be persisted immediately; no data loss on refresh or accidental navigation.

- Draft grading entries and in-progress mixing recipes must be retained server-side so staff can resume after accidental closure.

## 4.4 Security

- All data transmitted over HTTPS.

- Passwords stored using a secure one-way hashing algorithm (e.g. bcrypt).

- Role-based access enforced server-side; the Owner read-only constraint and the Superadmin-only scope (user management, flock creation, master data) must be enforced at the API layer.

- All login attempts (success and failure) logged with timestamp and IP address.

- Stock Corrections, flock lifecycle changes, and master-data edits are logged with user ID, timestamp, and before/after values. Correction logs are immutable and visible to Superadmin.

## 4.5 Scalability

- System must support up to 50 farmhouses and 10 warehouses without architectural changes.

- Database schema must accommodate multi-year historical data, including multi-flock history per kandang, without query degradation.

- The Egg SKU model must support up to 20 Type-grade variants without schema changes.

- Feed-ingredient and OVK item masters must each support at least 100 items without redesign.

## 4.6 Maintainability

- Configuration and master-data changes (kandang, warehouses, units, grade types, feed ingredients, OVK items, vaksin types) must not require code changes or restarts.

- Codebase must include technical documentation sufficient for a new developer to onboard within 2 working days.

# 5. System Constraints & Assumptions

## 5.1 Constraints

- System must be accessible on standard web browsers (Chrome, Firefox, Safari) without plugin installation.

- Internet connectivity is assumed at all data entry points. Offline-first capability is out of scope for v2.

- System is deployed for a single farm. Multi-farm support is out of scope for v2.

- Feed inventory is held in one central store; per-warehouse feed locations are out of scope. OVK is held in one central office store.

## 5.2 Assumptions

- Each kandang produces a configurable number of batches per day (default 2); individual kandang may differ. Batch-count changes take effect the following day.

- Type is established by physical separation of Omega and Normal egg streams from the rows through grading and lifting. Collection batches are not Type-split; only Angkat Rak and grading capture Type.

- An Angkat Rak lift for a kandang may contain both Types and is recorded split by Type at collection.

- Telur Kosong is tracked for hen-productivity insight only and never enters graded or warehouse stock, but is included in HD%.

- Telur Lunak and Telur Plastik enter warehouse stock as saleable grades (pcs).

- A flock is one chick-in delivery and may span multiple kandang; each kandang's portion is a placement with its own Populasi Awal and daily ledger. A kandang holds one active placement at a time.

- Body weight (BERAT BADAN) is sampled periodically (weekly) and recorded only in v2; analytics on it are deferred.

- Feed mixing is performed the evening before consumption but dated to the consumption day. The fresh mix is netted by the prior day's reusable leftover; supplement/premix weights are entered fixed and not auto-scaled.

- OVK stock decreases when items are transferred from the office to a kandang, not when administered to hens. Daily-record OBAT/VITAMIN entries are administration notes only.

- VAKSIN is logged as activity only; no vaccine inventory is tracked.

- Egg quantities are stored in pcs and displayed as 'rak + pcs' (1 rak = 30 pcs). Rounding occurs only at display.

- All graded quantities are entered manually after physical counting; no automated weighing/counting hardware is in scope for v2.

- Existing spreadsheet data migration is defined separately and is not part of this SRS.

# 6. Key Use Cases

### UC-01: Daily Batch Collection Entry (with Angkat Rak by Type)

|                   |                                                                                                                                                                                                                                                                                                                                                         |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Actor**         | Admin                                                                                                                                                                                                                                                                                                                                                   |
| **Precondition**  | Admin logged in; selected kandang/batch has no collection entry today.                                                                                                                                                                                                                                                                                  |
| **Main Flow**     | 1. Open New Collection Entry. 2. Select kandang and batch. 3. Enter Good Eggs, Telur Retak, Telur Lunak, Telur Kosong (pcs). 4. If lifting, enter Angkat Rak split by Type (Normal; reveal Omega if needed). 5. Save. 6. System marks the batch complete and posts each Angkat Rak Type quantity to the assigned warehouse as 'Angkat Rak / <Type>'. |
| **Alternative**   | If an entry exists, it opens in edit mode with audit trail visible.                                                                                                                                                                                                                                                                                     |
| **Postcondition** | Collection saved; Angkat Rak (per Type) immediately in warehouse stock.                                                                                                                                                                                                                                                                                 |

### UC-02: Batch Grading Entry (Type tabs)

|                   |                                                                                                                                                                                                                                                                                                                                                                                         |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Actor**         | Admin                                                                                                                                                                                                                                                                                                                                                                                   |
| **Precondition**  | Batch N collection complete; if grading Batch N+1, Batch N grading already submitted.                                                                                                                                                                                                                                                                                                   |
| **Main Flow**     | 1. Open New Grading Entry. 2. Select kandang, date, batch. 3. System shows available quantity (Good Eggs minus total Angkat Rak). 4. Under each Type tab (Normal, Omega, ...), enter rak per Size & Health grade (pcs for Plastik/Lunak). 5. Live counter sums across tabs vs available. 6. Submit when reconciled. 7. System locks the batch and updates warehouse stock per Egg SKU. |
| **Validation**    | Submission blocked if combined graded pcs exceed available; warning shows the overage.                                                                                                                                                                                                                                                                                                  |
| **Postcondition** | Grading submitted; stock updated per Egg SKU; next batch unlocked.                                                                                                                                                                                                                                                                                                                      |

### UC-03: Owner Views Dashboard

|                   |                                                                                                                                                                                                                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Actor**         | Farm Owner (Owner role)                                                                                                                                                                                                                                                                     |
| **Precondition**  | Logged in as Owner; lands on the Dashboard.                                                                                                                                                                                                                                                 |
| **Main Flow**     | 1. See today's KPI cards (production, cracked %, kosong, grading completion, warehouse stock in rak+pcs, flock-health indicators). 2. Adjust date range. 3. Review grade distribution (Size & Health and Type), per-kandang comparison, and HD%/FCR trends. 4. Optionally export to Excel. |
| **Restrictions**  | No entry, configuration, or operational menus are ever visible or accessible to the Owner.                                                                                                                                                                                                  |
| **Postcondition** | No data modified.                                                                                                                                                                                                                                                                           |

### UC-04: Daily Farmhouse Recording

|                   |                                                                                                                                                                                                                                                                                                                                                                                                 |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Actor**         | Admin                                                                                                                                                                                                                                                                                                                                                                                           |
| **Precondition**  | Active placement exists for the kandang; collection (and ideally grading) done for the day.                                                                                                                                                                                                                                                                                                     |
| **Main Flow**     | 1. Open the daily record for kandang/date. 2. System pre-loads HARI, MINGGU, HIDUP, egg buckets (Utuh/Lunak/Pecah/Kosong), HD%, JENIS, PAKAN MASUK, PAKAN TERSEDIA, and VAKSIN. 3. Admin enters MATI, AFKIR, SISA DIGUNAKAN, SISA DIBUANG, BERAT TELUR, body weight (if sampling day), and OBAT/VITAMIN notes and KETERANGAN. 4. System derives REALISASI INTAKE, GRAM/EKOR, and FCR. 5. Save. |
| **Validation**    | HIDUP cannot go negative; egg total reconciles to collection then grading.                                                                                                                                                                                                                                                                                                                      |
| **Postcondition** | Daily record saved; HIDUP carried forward; indicators available to dashboard/reports.                                                                                                                                                                                                                                                                                                           |

### UC-05: Set Daily Feed Mixing Recipe

|                   |                                                                                                                                                                                                                                                                                                                                                                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Actor**         | Admin                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Precondition**  | Feed ingredient master set up; central stock available; placement active.                                                                                                                                                                                                                                                                                                                                                                   |
| **Main Flow**     | 1. Open Mixing for kandang and consumption day (recipe pre-filled from yesterday). 2. System shows requirement TOTAL = HIDUP x projected intake, reusable leftover, and netted TOTAL CAMPUR. 3. Admin adjusts main-feed percentages and supplement fixed weights. 4. Confirm. 5. System draws down ingredient stock, logs the dated recipe, generates the printable pull-list, and posts PAKAN MASUK / PAKAN TERSEDIA to the daily record. |
| **Validation**    | Main-feed percentages sum to 100%; warning if any ingredient would go negative; fresh mix floored at 0 when leftover exceeds requirement.                                                                                                                                                                                                                                                                                                   |
| **Postcondition** | Mix recorded; ingredients reduced; pull-list ready; feed posted to the daily record.                                                                                                                                                                                                                                                                                                                                                        |

### UC-06: OVK Delivery and Transfer

|                   |                                                                                                                                                                                                                                                                                         |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Actor**         | Admin                                                                                                                                                                                                                                                                                   |
| **Precondition**  | OVK item master set up by Superadmin.                                                                                                                                                                                                                                                   |
| **Main Flow**     | 1. On delivery, record date/item/quantity/unit; office stock increases. 2. When taking items to a kandang, record an office-to-kandang transfer (date/item/quantity/unit/kandang/note); office stock decreases. 3. Generate the per-kandang Usage (Pemakaian) Report for a date range. |
| **Validation**    | Warning if a transfer would drive office stock negative.                                                                                                                                                                                                                                |
| **Postcondition** | Office stock reflects deliveries and transfers; usage report available.                                                                                                                                                                                                                 |

### UC-07: Record Sales Transaction

|                   |                                                                                                                                                                                                                                                                            |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Actor**         | Admin                                                                                                                                                                                                                                                                      |
| **Precondition**  | Buyer pre-registered and active; sufficient stock in the warehouse.                                                                                                                                                                                                        |
| **Main Flow**     | 1. Open Sales > New Transaction. 2. Select warehouse, buyer, date. 3. Add line items per Egg SKU (Size & Health + Type), quantity and unit (rak or pcs). 4. Running total (rak and pcs) shown. 5. Submit. 6. Stock deducted atomically; ledger entries created per line. |
| **Validation**    | If any SKU line exceeds stock, the whole transaction is blocked, naming the short SKU.                                                                                                                                                                                     |
| **Postcondition** | Stock deducted per SKU; transaction in Sales log and buyer history.                                                                                                                                                                                                        |

### UC-08: Configure New Flock (Chick-In) Across Kandang

|                   |                                                                                                                                                                                                                                    |
|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Actor**         | Superadmin                                                                                                                                                                                                                         |
| **Precondition**  | Target kandang are free (no active placement).                                                                                                                                                                                     |
| **Main Flow**     | 1. Open Flock > New Chick-In. 2. Enter strain, chick-in date, placement age (days). 3. Assign one or more kandang, each with its Populasi Awal. 4. Save. 5. Each placement becomes active; daily recording and mixing can begin. |
| **Postcondition** | Flock and placements active; HARI/HIDUP seeded per placement.                                                                                                                                                                      |

# 7. Data Requirements

## 7.1 Core Data Entities

Entities new or materially changed in v2.0 are marked. **Egg quantities are stored in pcs**; feed and OVK in their defined base units.

| **Entity**                           | **Key Attributes**                                                                                                                                                                                                                                                                     |
|--------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Flock** **(NEW)**                  | ID, Strain, Chick-In Date, Placement Age (days at chick-in), Status (Active/Ended), Created By, Created Date                                                                                                                                                                           |
| **Placement** **(NEW)**              | ID, Flock ID, Kandang ID, Populasi Awal (initial population), Start Date, End Date, Status (Active/Ended)                                                                                                                                                                              |
| **Farmhouse (Kandang)**              | ID, Name, Code, Status, Assigned Warehouse ID, Max Batches Per Day (default 2), Created Date                                                                                                                                                                                           |
| **Warehouse**                        | ID, Name, Code, Status, Low-Stock Thresholds (per Egg SKU)                                                                                                                                                                                                                             |
| **Farmhouse-Warehouse Mapping Log**  | ID, Kandang ID, Warehouse ID, Effective From Date, Changed By                                                                                                                                                                                                                          |
| **Collection Record** **(CHANGED)**  | ID, Date, Kandang ID, Batch Number, Good Eggs (pcs), Telur Retak (pcs), Telur Lunak (pcs), Telur Kosong (pcs), Remarks, Entered By, Timestamp                                                                                                                                          |
| **Angkat Rak Lift** **(NEW)**        | ID, Collection Record ID, Type Grade ID, Quantity (pcs). One row per Type lifted in a batch.                                                                                                                                                                                           |
| **Grading Record**                   | ID, Date, Kandang ID, Batch Number, Linked Collection ID, Status (Draft/Submitted), Remarks, Entered By, Timestamp                                                                                                                                                                     |
| **Grading Record Line Item**         | ID, Grading Record ID, Size & Health Grade (enum), Type Grade ID (FK), Quantity (pcs)                                                                                                                                                                                                  |
| **Grade Type**                       | ID, Name (Normal Egg, Omega Egg, ...), Status, Sort Order. Managed by Superadmin.                                                                                                                                                                                                      |
| **Egg SKU**                          | Derived: Size & Health Grade + Type Grade ID. Full matrix; composite key, no separate table required.                                                                                                                                                                                  |
| **Warehouse Stock**                  | ID, Warehouse ID, Size & Health Grade, Type Grade ID, Current Quantity (pcs), Last Updated                                                                                                                                                                                             |
| **Sales Transaction**                | ID, Date, Warehouse ID, Buyer ID, Status (Active/Voided), Void Reason, Notes, Entered By, Timestamp                                                                                                                                                                                    |
| **Sales Transaction Line Item**      | ID, Transaction ID, Size & Health Grade, Type Grade ID, Quantity (pcs), Unit Used for Entry                                                                                                                                                                                            |
| **Buyer**                            | ID, Name, Status (Active/Inactive), Created Date                                                                                                                                                                                                                                       |
| **Stock Movement**                   | ID, Warehouse ID, Size & Health Grade, Type Grade ID, Movement Type (In/Out/Correction/Void), Quantity (pcs), Unit Used, Date, Source Type (Grading/Angkat Rak/Sales/Correction), Source Reference ID, Reason, Pre-Quantity, Post-Quantity, Entered By                                 |
| **Measurement Unit** **(CHANGED)**   | ID, Name (Rak, Pcs, ...), Pcs Equivalent (Rak = 30), Active. Managed by Superadmin.                                                                                                                                                                                                    |
| **Daily Farmhouse Record** **(NEW)** | ID, Date, Placement ID (-> Kandang + Flock), MATI, AFKIR, HIDUP (snapshot), SISA DIGUNAKAN (kg), SISA DIBUANG (kg), PAKAN MASUK (kg, derived), PAKAN TERSEDIA (kg, derived), BERAT TELUR (kg), BERAT BADAN (kg, nullable), OBAT Note, VITAMIN Note, KETERANGAN, Entered By, Timestamp |
| **Feed Ingredient** **(NEW)**        | ID, Name, Category (Konsentrat/Finished, Premix/Supplement, Grain, Bran), Base Unit, Conversions, Status. Managed by Superadmin.                                                                                                                                                       |
| **Feed Delivery** **(NEW)**          | ID, Date, Ingredient ID, Quantity (base unit), Entered By, Timestamp                                                                                                                                                                                                                   |
| **Feed Ingredient Stock** **(NEW)**  | ID, Ingredient ID, Current Quantity (base unit), Last Updated. Single central store.                                                                                                                                                                                                   |
| **Mixing Event (Recipe)** **(NEW)**  | ID, Consumption Date, Placement ID, Projected Intake (g/bird), Population Snapshot, Requirement Total (kg), Sisa In (kg), Total Campur / Fresh Mix (kg), Entered By, Timestamp                                                                                                         |
| **Mixing Recipe Line** **(NEW)**     | ID, Mixing Event ID, Ingredient ID, Line Type (Percentage / Fixed), Percentage (nullable), Weight (kg)                                                                                                                                                                                 |
| **OVK Item** **(NEW)**               | ID, Name, Category (Obat/Vitamin/Chemical), Base Unit, Conversions, Status. Managed by Superadmin.                                                                                                                                                                                     |
| **OVK Delivery** **(NEW)**           | ID, Date, Item ID, Quantity (base unit), Unit Used, Entered By                                                                                                                                                                                                                         |
| **OVK Stock** **(NEW)**              | ID, Item ID, Current Quantity (base unit), Last Updated. Single office store.                                                                                                                                                                                                          |
| **OVK Transfer** **(NEW)**           | ID, Date, Item ID, Kandang ID, Quantity (base unit), Unit Used, Note, Entered By                                                                                                                                                                                                       |
| **Vaksin Type** **(NEW)**            | ID, Name, Status. Managed by Superadmin.                                                                                                                                                                                                                                               |
| **Vaksin Log** **(NEW)**             | ID, Date, Vaksin Type ID, Vials, Kandang ID, Vaccinator, Entered By, Timestamp                                                                                                                                                                                                         |
| **User**                             | ID, Name, Username, Role (Superadmin/Owner/Admin), Status, Last Login                                                                                                                                                                                                                  |

### 7.1.1 As-built additions & refinements — v2.0.1

*(Added during the Slice 1–12 build; see `BUILD_LOG.md` and `prisma/schema.prisma`. These annotate — they do not replace — the §7.1 conceptual list. Entities already in §7.1 that were built as specified are not repeated here; a few were realized differently, noted below.)*

| **Entity (as-built)**                     | **Key Attributes / Note**                                                                                                                                                                                                                                        |
|-------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **HIDUP Snapshot** **(NEW)**              | ID, Placement ID, Date (business), MATI, AFKIR, HIDUP. One **write-once** row per (placement, business date), seeded at chick-in from Populasi Awal — the running-HIDUP ledger behind the daily record's HIDUP; resolved latest-≤-date, never recomputed.        |
| **Feed Ingredient Movement** **(NEW)**    | ID, Ingredient ID, Movement Type (In/Out/**Correction**), Quantity (kg), Source Type (Delivery/Mixing/Correction), Source Ref ID, Reason, Pre-Quantity, Post-Quantity, Date, Entered By. **Append-only ledger** — a "Feed Delivery" is a Delivery movement here, not a separate table. |
| **OVK Movement** **(NEW)**                | ID, Item ID, Movement Type (In/Out/**Correction**), Source Type (Delivery/Transfer/Correction), Quantity (base unit), Entered Quantity + Unit Used, Kandang ID (transfers), Note, Reason, Pre/Post-Quantity, Date, Entered By. **Append-only ledger** — realizes OVK Delivery + Transfer + Correction as one table. |
| **OVK Unit Conversion** **(NEW)**         | ID, Item ID, Unit Name, Factor To Base. `1 Unit Name = Factor × base unit` (e.g. 1 botol = 1 liter; 1 pcs = 100 gram). The reusable per-item conversion mechanism (also intended for feed karung→kg).                                                            |
| **Farmhouse Batch Setting Log** **(NEW)** | ID, Kandang ID, Max Batches Per Day, Effective From Date, Changed By. **Effective-dated** (value in force on date D = greatest `Effective From ≤ D`); a change is future-dated to D+1 (FR-41). Mirrors the Mapping Log.                                            |
| **Low-Stock Threshold** **(NEW)**         | ID, Warehouse ID, Size & Health Grade, Type Grade ID, Min Quantity (pcs). Its **own table** (not a column on Warehouse), so a threshold write never touches the ledger-owned balance cache.                                                                      |
| **Session** **(NEW)**                     | ID, User ID, Expires At, Created At. DB-backed auth session; the signed httpOnly cookie carries only the session id, so deactivation/logout take effect on the next request.                                                                                     |
| **Daily Farmhouse Record** *(refined)*    | As-built also stores frozen HD%, REALISASI INTAKE (kg), GRAM/EKOR, daily FCR, JENIS, and reusable-leftover-in; and has **no stored VAKSIN field** — VAKSIN is derived live from the Vaksin Log (FR-101).                                                          |
| **Stock / Ingredient / OVK Movement** *(correction)* | All three movement ledgers support an immutable **CORRECTION** (pre/post + mandatory reason ≥ 20 chars); to fix a wrong correction, append a second one — never edit.                                                                             |

## 7.2 Data Retention

- All production, grading, stock movement, daily flock, feed, OVK, and vaksin records must be retained indefinitely.

- Audit logs (edits, user actions, mapping changes, stock corrections, flock lifecycle, master-data edits) retained for a minimum of 3 years.

- Deactivated kandang, warehouses, grade types, feed ingredients, and OVK items retain history; only excluded from new entries.

- Stock Correction logs are immutable; a second correction is required to further adjust.

- Ended flock placements retain full daily history; a kandang's multi-flock history is preserved across re-population.

# 8. Reporting & Analytics Requirements

## 8.1 Standard Reports

| **Report Name**                                       | **Description**                                                                                                                                   | **Access Role**          |
|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------|
| **Daily Collection Summary**                          | Eggs per kandang per batch: Good, Retak, Lunak, Kosong, Angkat Rak (by Type).                                                                     | Admin, Superadmin, Owner |
| **Cracked Egg Rate Report**                           | Retak + Lunak as % of total collected, per kandang and period; flagged above threshold.                                                           | Admin, Superadmin, Owner |
| **Telur Kosong Report**                               | Empty-shell trend per kandang (hen-productivity indicator).                                                                                       | Admin, Superadmin, Owner |
| **Grade Distribution Report**                         | Volume per Size & Health grade over a period (rak and pcs), with secondary Type breakdown.                                                        | Admin, Superadmin, Owner |
| **Angkat Rak Report**                                 | Volume and % of Angkat Rak vs graded stock per kandang per period, split by Type.                                                                 | Admin, Superadmin, Owner |
| **Warehouse Stock Report**                            | Current and historical stock per warehouse per Egg SKU (rak and pcs).                                                                             | Admin, Superadmin, Owner |
| **Kandang Comparison**                                | Side-by-side production across active kandang for a period.                                                                                       | Admin, Superadmin, Owner |
| **Stock Movement Ledger**                             | Full in/out log per warehouse: Egg SKU, source, quantity, movement type, user, date. Corrections flagged.                                         | Admin, Superadmin        |
| **Stock Correction Audit Report**                     | All corrections: warehouse, Egg SKU, pre/post quantity, delta, reason, user, timestamp.                                                           | Superadmin only          |
| **Grading Completion Report**                         | Which batches have pending grading; end-of-day reconciliation.                                                                                    | Admin, Superadmin, Owner |
| **Buyer Daily Sales Report**                          | Per buyer: eggs purchased per day by Egg SKU (rak and pcs). Filterable.                                                                           | Admin, Superadmin, Owner |
| **Buyer Weekly Sales Report**                         | Per buyer: weekly totals by Egg SKU; all active buyers side by side.                                                                              | Admin, Superadmin, Owner |
| **Sales Transaction Log**                             | All transactions: buyer, warehouse, date, line items by Egg SKU, totals, status (voided marked).                                                  | Admin, Superadmin        |
| **Daily Farmhouse Record Report** **(NEW)**           | Per kandang per day: MATI, AFKIR, HIDUP, HARI/MINGGU, feed (MASUK/TERSEDIA/SISA/INTAKE/gram-ekor), egg buckets, HD%, FCR, treatments, KETERANGAN. | Admin, Superadmin, Owner |
| **Flock Production & Health Report** **(NEW)**        | Per placement over its life: HD% and FCR trends, cumulative mortality/culls, body-weight samples.                                                 | Admin, Superadmin, Owner |
| **Feed Mixing Pull-List** **(NEW)**                   | Printable per-kandang per-day ingredient list with weights and units for the feed warehouse.                                                      | Admin, Superadmin        |
| **Feed Consumption Report** **(NEW)**                 | Per kandang per period: PAKAN MASUK/TERSEDIA, SISA, REALISASI INTAKE, gram/ekor.                                                                  | Admin, Superadmin, Owner |
| **Feed Ingredient Stock & Delivery Report** **(NEW)** | Central ingredient stock levels and delivery history.                                                                                             | Admin, Superadmin        |
| **OVK Usage (Pemakaian) Report** **(NEW)**            | Office-to-kandang transfers grouped by kandang over a date range: date, item, quantity out, unit, note.                                           | Admin, Superadmin        |
| **OVK Stock Report** **(NEW)**                        | Current office stock per OVK item; delivery/transfer history.                                                                                     | Admin, Superadmin        |
| **Vaksin Log Report** **(NEW)**                       | Vaccination activity: date, vaksin type, vials, kandang, vaccinator. Filterable.                                                                  | Admin, Superadmin, Owner |

## 8.2 Dashboard KPI Cards

Shown for the current day with comparison to the previous day where applicable:

- Total Eggs Collected Today (pcs and rak)

- Total Angkat Rak Today (pcs and rak), split by Type

- Cracked Egg % Today — (Retak + Lunak) / Total Collected — delta vs yesterday

- Telur Kosong Count Today — delta vs yesterday

- Grading Completion Rate — % of submitted batches with completed grading

- Total Warehouse Stock — across warehouses, by Egg SKU (rak + pcs)

- Batches Pending Collection — expected batches not yet entered today

- Total Eggs Sold Today — across buyers and warehouses (rak + pcs), by Egg SKU

- Top Buyers This Week — ranked by volume

- Type Grade Breakdown — Omega vs Normal (and other types) in today's production and stock

- Flock Mortality Today — total MATI + AFKIR across kandang, with HIDUP totals (NEW)

- Average HD% Today — across active placements (NEW)

- Average Daily FCR — across active placements (NEW)

- Feed Mixed Today — total PAKAN MASUK across kandang, kg (NEW)

# 9. Ripple Effect & Change Impact Analysis

This section documents the cross-cutting impacts of the changes introduced in v2.0. Development teams should review it before implementation. It supersedes the v1.3 ripple analysis.

## 9.1 Tray to Rak Rename & Mixed-Unit Display

| **Area Affected**             | **Impact**                                                                                                                  | **Action Required**                                                                                |
|-------------------------------|-----------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| **Unit master & conversions** | The base sales unit changes from 'Tray' to 'Rak' (still 30 pcs). All references to 'tray' in FRs, KPIs, and reports change. | Rename the unit; update every 'tray' label to 'rak' across UI and reports. Keep 30-pcs conversion. |
| **Display layer**             | Quantities must render as mixed 'X rak + Y pcs', not decimal rak.                                                           | Add a single pcs-to-(rak+pcs) display formatter used everywhere; never store the rounded form.     |
| **Sales & grading entry**     | Entry must still accept rak or pcs; mixed format is display-only.                                                           | Keep numeric entry in either unit; convert to pcs on save.                                         |
| **Reports & dashboard**       | All rak figures in stock, sales, and KPI cards use the mixed format.                                                        | Apply the formatter consistently; verify totals reconcile in pcs.                                  |

## 9.2 Grade Model: Angkat Rak & Lunak as Size & Health Grades; Full SKU Matrix

| **Area Affected**          | **Impact**                                                                                                            | **Action Required**                                                                        |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| **Grade definitions**      | Angkat Rak and Telur Lunak are first-class Size & Health grades; full Size x Type matrix is valid with no allow-list. | Treat every active Size x Type as a SKU implicitly; Superadmin manages only the Type list. |
| **Warehouse stock schema** | Stock keyed by (Size & Health grade, Type grade) composite, uniform across all grades.                                | No nullable/sentinel type for any grade; single composite key path.                        |
| **UI density**             | Up to 11 grades x N types yields many SKUs, many permanently zero for a given farm.                                   | Hide empty SKUs gracefully in tables and charts; do not render walls of zeros.             |
| **Reporting**              | All grade-level reports group/filter by both dimensions.                                                              | Add Type dimension to every grade report and chart; keep Size & Health primary.            |

## 9.3 Type Capture via Physical Separation (Tabs; Angkat Rak by Type)

| **Area Affected**   | **Impact**                                                                                                              | **Action Required**                                                                                                         |
|---------------------|-------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| **Collection form** | Angkat Rak gains a per-Type split; a single lift may carry both Types.                                                  | Replace the single Angkat Rak field with per-Type inputs (Omega hidden until used); store one Angkat Rak Lift row per Type. |
| **Grading form**    | Grading is organised by Type tabs over the 11-grade Size & Health column.                                               | Build tabbed grading; the live counter sums across tabs.                                                                    |
| **Reconciliation**  | Graded total reconciles as one combined figure vs (Good Eggs - total Angkat Rak); per-Type cross-check is not possible. | Validate combined total only; document the accepted integrity limitation resting on physical separation.                    |
| **Stock posting**   | Angkat Rak posts per Type as 'Angkat Rak / <Type>' on collection save.                                                | Post each Angkat Rak Type quantity as its own SKU immediately.                                                              |

## 9.4 Flock Layer & Daily Farmhouse Recording

| **Area Affected**                | **Impact**                                                                                                  | **Action Required**                                                                                          |
|----------------------------------|-------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| **New flock/placement entities** | A flock (delivery-level) spans one or more per-kandang placements, each with its own population and ledger. | Add Flock and Placement entities; placement holds Populasi Awal; one active placement per kandang.           |
| **Stateful HIDUP**               | HIDUP is a running balance across the flock's life, sensitive to ordering of daily records.                 | Compute HIDUP as a running balance seeded at chick-in; snapshot per daily record for integrity.              |
| **Egg-bucket derivation**        | Daily egg buckets derive from collection (live), reconcile to grading; Pecah sub-split firms after grading. | Derive buckets from collection first; recompute on grading completion; keep daily total stable.              |
| **HD% & FCR**                    | HD% uses all eggs incl. Kosong; FCR is true intake/egg-mass, replacing the old salvage ratio.               | Implement HD% over all four buckets; compute daily FCR = REALISASI INTAKE / BERAT TELUR; drop the old ratio. |
| **Section 10 scope**             | Feed & mortality tracking, previously out of scope, is now in scope via this layer.                         | Remove it from Future Considerations; implement under Modules 9-13.                                          |
| **Multi-flock history**          | A kandang is re-populated over time; reports must not bleed across flocks.                                  | Scope production/health analytics to the placement; preserve prior-flock history.                            |

## 9.5 PAKAN (Feed) Management & Mixing

| **Area Affected**                | **Impact**                                                                                                             | **Action Required**                                                                                                       |
|----------------------------------|------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| **Central ingredient inventory** | Raw ingredients (grains, konsentrat/finished feed, premix/supplement) held in one central store; deliveries add stock. | Add ingredient master (Superadmin), delivery entry, and a single central stock ledger.                                    |
| **Mixing as a BOM event**        | A mix consumes ingredients by recipe and outputs TOTAL CAMPUR.                                                         | Compute requirement = HIDUP x projected intake; net by reusable leftover (floor 0); draw down ingredients by line weight. |
| **Recipe lines**                 | Main feeds by % of fresh mix; supplements by fixed weight (no auto-scale).                                             | Support two line types; main-feed weights = % x fresh mix; supplement weights as entered.                                 |
| **Daily-record coupling**        | PAKAN MASUK (fresh mix) and PAKAN TERSEDIA (mix + leftover) feed the daily record; JENIS derives from the recipe.      | Post MASUK/TERSEDIA and JENIS to the consumption-day record; date recipe to consumption day.                              |
| **Edge case: no-mix day**        | If reusable leftover exceeds the requirement, fresh mix is 0 and TERSEDIA exceeds requirement.                         | Floor MASUK at 0; allow TERSEDIA to exceed requirement; surface as normal.                                                |
| **Printable pull-list**          | Feed warehouse needs a printable per-kandang ingredient sheet.                                                         | Generate the pull-list from confirmed recipe lines; talang/twice-daily distribution is out of scope.                      |

## 9.6 OVK Inventory

| **Area Affected**                      | **Impact**                                                                                   | **Action Required**                                                                                |
|----------------------------------------|----------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| **Single inventory, three categories** | Obat, Vitamin, Chemical share one master with a category and per-item units/conversions.     | Add OVK item master (Superadmin) with category and conversions; central office stock.              |
| **Stock-movement timing**              | Stock decreases on office-to-kandang transfer, not on hen administration.                    | Model delivery (in) and transfer (out); transfer is the reduction event.                           |
| **Daily-record decoupling**            | Daily OBAT/VITAMIN notes record administration, distinct from transfers; no double counting. | Keep daily notes free of stock effects; only transfers move stock. Chemicals have no daily column. |
| **Usage report**                       | Report mirrors the per-kandang 'Catatan Pemakaian Obat' sheet.                               | Build the per-kandang pemakaian report (date, item, qty out, unit, note).                          |

## 9.7 VAKSIN Logging

| **Area Affected**              | **Impact**                                                   | **Action Required**                                                                            |
|--------------------------------|--------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| **Activity log, no inventory** | Vaccination is logged only; no vaccine stock is tracked.     | Add vaksin-type master (Superadmin) and a vaksin log (date, type, vials, kandang, vaccinator). |
| **Daily-record derivation**    | The daily VAKSIN field reflects the log; it is not re-typed. | Derive the daily VAKSIN field from the log for that kandang/date.                              |

## 9.8 Role & Master-Data Realignment

| **Area Affected**                 | **Impact**                                                                                                       | **Action Required**                                                                        |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| **Master data to Superadmin**     | Units, Grade by Type, feed ingredients, OVK items, and vaksin types are Superadmin-managed catalogs.             | Move these from Admin to Superadmin; keep farmhouses/warehouses/mapping/buyers with Admin. |
| **Flock lifecycle to Superadmin** | Chick-in and placement end are Superadmin actions; daily recording is Admin.                                     | Gate flock create/end behind Superadmin; enforce server-side.                              |
| **Report access**                 | New reports inherit the access matrix (most visible to Owner; pull-list, ledger, OVK stock to Admin/Superadmin). | Update the access-control matrix for all reports in Section 8.1.                           |

# 10. Future Considerations (Out of Scope for v2)

- **Advanced Feed Mixing Distribution:** Modelling the physical split of one mix into multiple distributions and the twice-daily talang feeding; per-talang weights on the pull-list.

- **Mobile Native App:** Native Android/iOS app with offline-capable entry and background sync.

- **Automated Counting / Weighing Integration:** Egg counting / sorting hardware and automated body-weight or egg-mass capture.

- **Body-Weight Analytics:** Comparison of BERAT BADAN against breed-standard curves and feed-efficiency modelling (data is recorded in v2).

- **Accounting & Revenue:** Sales pricing per SKU, invoices, and integration with an external accounting platform.

- **OVK & Vaccine Cost / Expiry:** Cost, batch, and expiry tracking for OVK items and vaccine vials.

- **Multi-Farm Support:** Managing multiple farm locations under one account.

- **Barcode / QR Scanning:** Scanning tray/plastic labels or ingredient sacks for faster input.

- **Buyer Contact & Tiers:** Extending the Buyer entity with contact, address, and account-tier fields.

- **Scheduled Summary Report:** Automated daily PDF/email summary at a configurable time (partially covered by FR-59).

# 11. Acceptance Criteria Summary

The system is ready for go-live when all of the following are verified:

- All Must Have functional requirements are implemented and pass QA testing.

- An Admin can complete a batch collection entry (including an all-Normal Angkat Rak lift as a single number) in under 90 seconds on a smartphone.

- An Admin can record an Angkat Rak lift split into Normal and Omega, and each Type posts to warehouse stock as its own SKU.

- The grading sequence lock is enforced for any N: grading Batch N+1 before submitting Batch N is blocked.

- Grading captures Type via tabs; the live counter reconciles the combined graded total across tabs against available quantity.

- Egg quantities display everywhere as mixed 'rak + pcs' (1 rak = 30 pcs), with all storage and totals reconciling in pcs.

- The Owner dashboard loads in under 3 seconds and shows KPI cards, production and flock-health charts, grade distribution (Size & Health and Type), and warehouse stock in rak + pcs.

- The Owner role cannot submit any data, configuration, flock action, or correction — verified by direct API call and UI testing.

- Superadmin can create a flock spanning multiple kandang, each with its own Populasi Awal; HARI and HIDUP compute correctly per placement.

- A daily farmhouse record derives HARI, MINGGU, HIDUP, the four egg buckets, HD% (all eggs), JENIS, PAKAN MASUK/TERSEDIA, and VAKSIN, and computes REALISASI INTAKE, GRAM/EKOR, and daily FCR.

- A feed mixing event computes the netted fresh mix (floored at 0), draws down central ingredient stock by recipe line, generates a printable pull-list, and posts PAKAN MASUK/TERSEDIA to the daily record dated to the consumption day.

- OVK stock increases on delivery and decreases on office-to-kandang transfer; the per-kandang Usage (Pemakaian) report renders correctly; daily OBAT/VITAMIN notes do not move stock.

- A vaccination logged for a kandang/date appears in the daily record's VAKSIN field without re-entry.

- Master data (units, grade types, feed ingredients, OVK items, vaksin types) is Superadmin-managed and Admin-blocked, verified server-side.

- A sales transaction with multiple Egg SKU line items deducts stock atomically with no partial deductions.

- A Stock Correction with a valid 20+ character reason updates stock immediately and appears in the Superadmin Correction Audit Report; one without a sufficient reason is rejected.

- UAT is signed off by at least: one Admin (collection), one Admin (grading), one Admin (warehouse/sales), one Admin (daily recording/feed), and the Farm Owner.

# 12. Document Revision History

| **Version** | **Date**   | **Changes**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **Author**  |
|-------------|------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------|
| 1.0         | April 2026 | Initial draft.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | \[Author\]  |
| 1.1         | April 2026 | Batches/day per kandang, sequential grading lock, full grade definition, Telur Kosong/Lunak/Plastik clarified, multi-unit system, Angkat Rak bypass, Telur Plastik pcs-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | \[Author\]  |
| 1.2         | April 2026 | Buyer Management and Sales & Dispatch modules, buyer sales reports, Sales Summary KPI, Buyer and Sales entities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | \[Author\]  |
| 1.3         | May 2026   | Two-dimensional grading (Size & Health + Type, Egg SKU), 3-role model, Telur Lunak enters stock, Stock Correction mechanism, configurable batch count, ripple analysis.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | \[Author\]  |
| 2.0         | June 2026  | Major release. **Added:** Flock Management & Lifecycle (flock spanning multiple kandang as placements); Daily Farmhouse Recording (mortality, feed, body weight, treatments; derived HD%, true FCR, four egg buckets); PAKAN feed module (central ingredient inventory, per-kandang daily mixing with leftover netting, printable pull-list, feed posted to daily record); OVK inventory (Obat/Vitamin/Chemical, office deliveries and office-to-kandang transfers, pemakaian report); VAKSIN activity logging. **Changed:** Tray renamed to Rak with mixed 'rak + pcs' display and pcs-internal storage; Angkat Rak and Telur Lunak confirmed as Size & Health grades; full Egg SKU matrix; Type captured via grading tabs and per-lift Angkat Rak; master data (units, grade types, feed/OVK/vaksin catalogs) moved to Superadmin; flock lifecycle is Superadmin. Refreshed Section 9 ripple analysis; trimmed Section 10. | Amadeo Yesa |

**— End of Document —**
