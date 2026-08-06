# App.tsx Structured Audit

> Source: `/data/data/com.termux/files/home/repo/azadi/admin-app/src/App.tsx`
> Line count: 1121 (verified)

---

## Section 1 — Concern Groups

### auth

| Symbol / Lines                           | Summary                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `getInitData()` (L91-98)                 | Retrieves `initDataRaw` from Telegram `retrieveLaunchParams()`             |
| `headers` (L101-104)                     | Builds the `Authorization: Telegram <initData>` header used by every fetch |
| `currentUser` state (L21)                | Stores the user object returned from `/api/currentUser`                    |
| `setCurrentUser` in `fetchData()` (L114) | Sets user data after successful `/currentUser` fetch                       |
| `isSuperAdmin` derived (L175)            | `currentUser?.role === 'super_admin'` — drives role gating throughout      |
| `allowedCatId` derived (L176)            | `currentUser?.categoryId` — restricts category_admin scope                 |

### routing

| Symbol / Lines              | Summary                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `TAB_ICONS` constant (L5-8) | Emoji-to-tab-key mapping for bottom nav icons                                                                                  |
| `activeTab` state (L20)     | Holds current tab key: `'products' \| 'categories' \| 'settings' \| 'content' \| 'admins' \| 'menu' \| 'branches'`             |
| Tab title block (L580-587)  | Renders page heading based on `activeTab`                                                                                      |
| Bottom nav bar (L1091-1118) | Fixed-position tab buttons with role-based visibility (super_admin sees all 7; category_admin sees Products + Categories only) |

### data fetching

| Symbol / Lines                                              | Summary                                                                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fetchData()` (L106-169)                                    | Monolithic async function: fetches `/currentUser`, then `/products` + `/categories` in parallel, then conditionally `/settings`, `/admins`, `/menu-config`, `/faqs`, `/branches` for super_admin |
| `useEffect(() => { fetchData(); }, [])` (L171-173)          | Runs `fetchData` once on mount                                                                                                                                                                   |
| `loading` state (L28)                                       | Loading spinner flag; set `true` at start of `fetchData`, `false` in finally                                                                                                                     |
| `error` state (L29)                                         | Error message string; set in catch blocks and cleared before each fetch/mutation                                                                                                                 |
| `products` state (L23)                                      | Products list from `/products`                                                                                                                                                                   |
| `categories` state (L24)                                    | Categories list from `/categories`                                                                                                                                                               |
| `settings` state (L25)                                      | Settings list from `/settings` (super_admin only)                                                                                                                                                |
| `admins` state (L26)                                        | Admins list from `/admins` (super_admin only)                                                                                                                                                    |
| `menuConfigs` state (L45)                                   | Menu configs list from `/menu-config` (super_admin only)                                                                                                                                         |
| `branches` state (L50)                                      | Branches list from `/branches` (super_admin only)                                                                                                                                                |
| `faqs` state (L51)                                          | FAQs list from `/faqs` (super_admin only)                                                                                                                                                        |
| Every handler that calls `await fetchData()` after mutation | Products (L207, L251, L265), Categories (L314, L325), Admins (L351, L361), Settings (L399), Branches (L424, L435), FAQs (L466, L477), Menu (L500, L519, L527, L546), Special msg (L564)          |

### page-level components

| Page            | Lines      | Summary                                                                                                                                                           |
| --------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Products**    | L593-720   | Product add/edit form (with coffee details sub-form), product list with edit/delete/batch-select, and batch action bar                                            |
| **Categories**  | L723-770   | Category add/edit form (super_admin only) and category list with edit/delete                                                                                      |
| **Admins**      | L773-815   | Admin add form (super_admin only) and admin list with remove button                                                                                               |
| **Branches**    | L818-862   | Branch add/edit form (super_admin only) and branch list with edit/delete                                                                                          |
| **Content**     | L865-917   | About Us textarea save, FAQ add/edit form, and FAQ list (super_admin only)                                                                                        |
| **Settings**    | L920-1003  | Settings form with built-in keys (instagram, phone, price_unit, ai_greeting), custom settings CRUD, and add-custom-setting form (super_admin only)                |
| **Menu Config** | L1006-1089 | Section selector tabs, menu config items with visibility toggle / reorder / delete / special message editing, and add-category-to-section form (super_admin only) |

### shared primitives

| Primitive                          | Lines                                                                                                    | Summary |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| `Field` component (L10-17)         | Reusable labeled form field wrapper using `.field` / `.field-label` CSS classes                          |
| Toast (L32-36 state + L590 render) | `toast` state + `showToast()` helper + inline JSX render of `.toast` / `.toast-success` / `.toast-error` |
| Error banner (L589)                | `{error && <div className="error">{error}</div>}` — rendered once at top level                           |
| Loading screen (L569-576)          | Full-page loading spinner shown while `loading && products.length === 0`                                 |
| Empty states                       | `.empty-state` blocks at L657, L751, L800, L860, L914 — "No X yet." pattern                              |

### confirmation modals

| Line | Callsite text                                                       | Context                   |
| ---- | ------------------------------------------------------------------- | ------------------------- |
| L187 | `confirm('Apply action to ${selectedProductIds.length} products?')` | Batch execute on products |
| L261 | `confirm('Are you sure you want to delete this product?')`          | Delete single product     |
| L321 | `confirm('Are you sure?')`                                          | Delete category           |
| L357 | `confirm('Remove admin?')`                                          | Delete admin              |
| L395 | `confirm('Delete setting ${key}?')`                                 | Delete custom setting     |
| L431 | `confirm('Delete this branch?')`                                    | Delete branch             |
| L473 | `confirm('Delete this FAQ?')`                                       | Delete FAQ                |
| L524 | `confirm('Remove from menu?')`                                      | Delete menu config item   |

**All 8 are `window.confirm()` calls.** There is no inline modal JSX anywhere in the file.

---

## Section 2 — Inventory of State and Effects

| #   | Line | Variable                | Concern group           | Owns it after split                                         | Remote data / Local UI |
| --- | ---- | ----------------------- | ----------------------- | ----------------------------------------------------------- | ---------------------- |
| 1   | L20  | `activeTab`             | routing                 | App shell                                                   | Local UI               |
| 2   | L21  | `currentUser`           | auth                    | App shell / AuthProvider                                    | Remote data            |
| 3   | L23  | `products`              | data fetching           | Products page                                               | Remote data            |
| 4   | L24  | `categories`            | data fetching           | Categories page (also read by Products, Admins, MenuConfig) | Remote data            |
| 5   | L25  | `settings`              | data fetching           | Settings page                                               | Remote data            |
| 6   | L26  | `admins`                | data fetching           | Admins page                                                 | Remote data            |
| 7   | L28  | `loading`               | data fetching           | App shell / data-fetching hook                              | Local UI               |
| 8   | L29  | `error`                 | data fetching           | App shell / data-fetching hook                              | Local UI               |
| 9   | L32  | `toast`                 | shared primitives       | Toast component / useToast hook                             | Local UI               |
| 10  | L39  | `selectedProductIds`    | page-level (Products)   | Products page                                               | Local UI               |
| 11  | L40  | `batchAction`           | page-level (Products)   | Products page                                               | Local UI               |
| 12  | L41  | `batchTargetCatId`      | page-level (Products)   | Products page                                               | Local UI               |
| 13  | L42  | `batchToggleValue`      | page-level (Products)   | Products page                                               | Local UI               |
| 14  | L45  | `menuConfigs`           | data fetching           | MenuConfig page                                             | Remote data            |
| 15  | L46  | `menuActiveSection`     | page-level (MenuConfig) | MenuConfig page                                             | Local UI               |
| 16  | L47  | `menuAddCatId`          | page-level (MenuConfig) | MenuConfig page                                             | Local UI               |
| 17  | L50  | `branches`              | data fetching           | Branches page                                               | Remote data            |
| 18  | L51  | `faqs`                  | data fetching           | Content page                                                | Remote data            |
| 19  | L54  | `editingCategory`       | page-level (Categories) | Categories page                                             | Local UI               |
| 20  | L55  | `editingProduct`        | page-level (Products)   | Products page                                               | Local UI               |
| 21  | L58  | `catName`               | page-level (Categories) | Categories page                                             | Local UI               |
| 22  | L59  | `catEmoji`              | page-level (Categories) | Categories page                                             | Local UI               |
| 23  | L60  | `catDesc`               | page-level (Categories) | Categories page                                             | Local UI               |
| 24  | L61  | `catSort`               | page-level (Categories) | Categories page                                             | Local UI               |
| 25  | L63  | `prodName`              | page-level (Products)   | Products page                                               | Local UI               |
| 26  | L64  | `prodPrice`             | page-level (Products)   | Products page                                               | Local UI               |
| 27  | L65  | `prodStock`             | page-level (Products)   | Products page                                               | Local UI               |
| 28  | L66  | `prodCatId`             | page-level (Products)   | Products page                                               | Local UI               |
| 29  | L67  | `prodDesc`              | page-level (Products)   | Products page                                               | Local UI               |
| 30  | L68  | `prodAvailable`         | page-level (Products)   | Products page                                               | Local UI               |
| 31  | L71  | `isCoffeeBean`          | page-level (Products)   | Products page                                               | Local UI               |
| 32  | L72  | `coffeeOrigin`          | page-level (Products)   | Products page                                               | Local UI               |
| 33  | L73  | `coffeeFarm`            | page-level (Products)   | Products page                                               | Local UI               |
| 34  | L74  | `coffeeAltitude`        | page-level (Products)   | Products page                                               | Local UI               |
| 35  | L75  | `coffeeProcessing`      | page-level (Products)   | Products page                                               | Local UI               |
| 36  | L76  | `coffeeVariety`         | page-level (Products)   | Products page                                               | Local UI               |
| 37  | L77  | `coffeeRoastLevel`      | page-level (Products)   | Products page                                               | Local UI               |
| 38  | L78  | `coffeeFlavorNotes`     | page-level (Products)   | Products page                                               | Local UI               |
| 39  | L79  | `coffeeRecommendedBrew` | page-level (Products)   | Products page                                               | Local UI               |
| 40  | L80  | `coffeeAcidity`         | page-level (Products)   | Products page                                               | Local UI               |
| 41  | L81  | `coffeeBody`            | page-level (Products)   | Products page                                               | Local UI               |
| 42  | L83  | `adminId`               | page-level (Admins)     | Admins page                                                 | Local UI               |
| 43  | L84  | `adminRole`             | page-level (Admins)     | Admins page                                                 | Local UI               |
| 44  | L85  | `adminCatId`            | page-level (Admins)     | Admins page                                                 | Local UI               |
| 45  | L88  | `newSettingKey`         | page-level (Settings)   | Settings page                                               | Local UI               |
| 46  | L89  | `newSettingValue`       | page-level (Settings)   | Settings page                                               | Local UI               |
| 47  | L404 | `editingBranch`         | page-level (Branches)   | Branches page                                               | Local UI               |
| 48  | L405 | `branchName`            | page-level (Branches)   | Branches page                                               | Local UI               |
| 49  | L406 | `branchAddress`         | page-level (Branches)   | Branches page                                               | Local UI               |
| 50  | L407 | `branchPhone`           | page-level (Branches)   | Branches page                                               | Local UI               |
| 51  | L408 | `branchLocation`        | page-level (Branches)   | Branches page                                               | Local UI               |
| 52  | L409 | `branchHours`           | page-level (Branches)   | Branches page                                               | Local UI               |
| 53  | L410 | `branchActive`          | page-level (Branches)   | Branches page                                               | Local UI               |
| 54  | L453 | `editingFaq`            | page-level (Content)    | Content page                                                | Local UI               |
| 55  | L454 | `faqQuestion`           | page-level (Content)    | Content page                                                | Local UI               |
| 56  | L455 | `faqAnswer`             | page-level (Content)    | Content page                                                | Local UI               |
| 57  | L551 | `editingSpecialMsg`     | page-level (MenuConfig) | MenuConfig page                                             | Local UI               |
| 58  | L552 | `specialMsgValue`       | page-level (MenuConfig) | MenuConfig page                                             | Local UI               |

**Summary:** 58 `useState` calls. 8 are remote-data state; 48 are local UI state; 1 is loading flag; 1 is error flag.

**Effects:**

| #   | Line     | Dependency        | Concern       | Owns it after split                               |
| --- | -------- | ----------------- | ------------- | ------------------------------------------------- |
| 1   | L171-173 | `[]` (mount only) | data fetching | `useFetchAll()` hook or per-page `useQuery` calls |

Only 1 `useEffect` in the entire file.

---

## Section 3 — Inventory of Fetch Calls

| #   | Line(s) | Endpoint pattern                    | Method   | Concern group    | Owns it after split                               | Pattern                                  |
| --- | ------- | ----------------------------------- | -------- | ---------------- | ------------------------------------------------- | ---------------------------------------- |
| 1   | L111    | `/currentUser`                      | GET      | auth             | App shell / useFetchAll                           | useEffect + useState                     |
| 2   | L120    | `/products`                         | GET      | data fetching    | Products page                                     | useEffect + useState (inside fetchData)  |
| 3   | L121    | `/categories`                       | GET      | data fetching    | Shared (Categories, Products, Admins, MenuConfig) | useEffect + useState (inside fetchData)  |
| 4   | L136    | `/settings`                         | GET      | data fetching    | Settings page                                     | useEffect + useState (inside fetchData)  |
| 5   | L137    | `/admins`                           | GET      | data fetching    | Admins page                                       | useEffect + useState (inside fetchData)  |
| 6   | L138    | `/menu-config`                      | GET      | data fetching    | MenuConfig page                                   | useEffect + useState (inside fetchData)  |
| 7   | L139    | `/faqs`                             | GET      | data fetching    | Content page                                      | useEffect + useState (inside fetchData)  |
| 8   | L140    | `/branches`                         | GET      | data fetching    | Branches page                                     | useEffect + useState (inside fetchData)  |
| 9   | L202    | `/products/batch`                   | POST     | Products (batch) | Products page                                     | Imperative (click handler) — useMutation |
| 10  | L248    | `/products` or `/products/{id}`     | POST/PUT | Products         | Products page                                     | Imperative (form submit) — useMutation   |
| 11  | L263    | `/products/{id}`                    | DELETE   | Products         | Products page                                     | Imperative (click handler) — useMutation |
| 12  | L312    | `/categories` or `/categories/{id}` | POST/PUT | Categories       | Categories page                                   | Imperative (form submit) — useMutation   |
| 13  | L323    | `/categories/{id}`                  | DELETE   | Categories       | Categories page                                   | Imperative (click handler) — useMutation |
| 14  | L349    | `/admins`                           | POST     | Admins           | Admins page                                       | Imperative (form submit) — useMutation   |
| 15  | L359    | `/admins/{id}`                      | DELETE   | Admins           | Admins page                                       | Imperative (click handler) — useMutation |
| 16  | L371    | `/settings`                         | POST     | Settings         | Settings page                                     | Imperative (form submit) — useMutation   |
| 17  | L397    | `/settings/{key}`                   | DELETE   | Settings         | Settings page                                     | Imperative (click handler) — useMutation |
| 18  | L422    | `/branches` or `/branches/{id}`     | POST/PUT | Branches         | Branches page                                     | Imperative (form submit) — useMutation   |
| 19  | L433    | `/branches/{id}`                    | DELETE   | Branches         | Branches page                                     | Imperative (click handler) — useMutation |
| 20  | L464    | `/faqs` or `/faqs/{id}`             | POST/PUT | Content          | Content page                                      | Imperative (form submit) — useMutation   |
| 21  | L475    | `/faqs/{id}`                        | DELETE   | Content          | Content page                                      | Imperative (click handler) — useMutation |
| 22  | L496    | `/menu-config/{id}`                 | PUT      | MenuConfig       | MenuConfig page                                   | Imperative (click handler) — useMutation |
| 23  | L516    | `/menu-config/reorder`              | POST     | MenuConfig       | MenuConfig page                                   | Imperative (click handler) — useMutation |
| 24  | L526    | `/menu-config/{id}`                 | DELETE   | MenuConfig       | MenuConfig page                                   | Imperative (click handler) — useMutation |
| 25  | L536    | `/menu-config`                      | POST     | MenuConfig       | MenuConfig page                                   | Imperative (click handler) — useMutation |
| 26  | L558    | `/menu-config/{id}`                 | PUT      | MenuConfig       | MenuConfig page                                   | Imperative (click handler) — useMutation |

**Summary:** 26 distinct fetch calls. 8 are GETs suitable for `useQuery` (consolidated into the monolithic `fetchData`). 18 are mutations suitable for `useMutation`.

---

## Section 4 — Shared Primitives Extraction List

### Field

**Present:** L10-17.

```tsx
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
```

Used in Products form, Categories form, Admins form, Branches form, Content/FAQ form. Already a standalone function -- just needs to move to `components/Field.tsx`.

### Button

**Present:** Not as a reusable component. Buttons are plain `<button>` elements with CSS classes (`danger`, `secondary`) applied inline. Extracting a `<Button>` wrapper is possible but the existing CSS already handles all variants. Recommend **not** extracting a Button component -- the CSS classes are sufficient.

### Spinner (loading indicator)

**Present:** L569-576 (full-page loading screen) and CSS class `.spinner` at `index.css:243-252`.

```tsx
if (loading && products.length === 0) {
  return (
    <div className="container loading-screen">
      <div className="spinner" />
      <p>Loading…</p>
    </div>
  );
}
```

The CSS `.spinner` and `.loading-screen` classes are already defined. Extraction would create a `<Spinner>` or `<LoadingScreen>` component.

### Toast (transient notification)

**Present:** L32-36 (state + helper) and L590 (render).

State + helper:

```tsx
const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' } | null>(null);
const showToast = (msg: string, kind: 'success' | 'error' = 'success') => {
  setToast({ msg, kind });
  setTimeout(() => setToast(null), 3000);
};
```

Render:

```tsx
{
  toast && <div className={`toast toast-${toast.kind}`}>{toast.msg}</div>;
}
```

CSS classes `.toast`, `.toast-success`, `.toast-error` exist in `index.css:259-270`. Extraction into `useToast()` hook + `<Toast>` component.

### EmptyState

**Present:** 5 inline occurrences using `.empty-state` CSS class. Pattern:

```tsx
{
  items.length === 0 && !loading && <div className="empty-state">No items yet.</div>;
}
```

Lines: L657, L751, L800, L860, L914. CSS class `.empty-state` defined at `index.css:253`.

Extraction: `<EmptyState message="No products yet." />` component.

### ConfirmDialog

**Not present as JSX.** All 8 confirmation calls use `window.confirm()`. There is no inline modal JSX anywhere. Extraction would replace `window.confirm(msg)` with a promise-based `<ConfirmDialog>` or `useConfirm()` hook that returns a Promise<boolean>.

---

## Section 5 — Page Component Candidates

### 1. Products Page

| Property              | Value                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Line range**        | L593-720 (includes form L596-653, list L655-689, batch bar L692-718)                                                                                                                                                                                                                                                                                                                            |
| **Data dependencies** | `/products` (GET), `/categories` (GET), `/products/batch` (POST), `/products` (POST/PUT), `/products/{id}` (DELETE)                                                                                                                                                                                                                                                                             |
| **State**             | `products`, `editingProduct`, `selectedProductIds`, `batchAction`, `batchTargetCatId`, `batchToggleValue`, `prodName`, `prodPrice`, `prodStock`, `prodCatId`, `prodDesc`, `prodAvailable`, `isCoffeeBean`, `coffeeOrigin`, `coffeeFarm`, `coffeeAltitude`, `coffeeProcessing`, `coffeeVariety`, `coffeeRoastLevel`, `coffeeFlavorNotes`, `coffeeRecommendedBrew`, `coffeeAcidity`, `coffeeBody` |
| **Description**       | CRUD for products with a coffee-details sub-form, inline edit toggle, and a batch action bar for bulk move/toggle/delete.                                                                                                                                                                                                                                                                       |

### 2. Categories Page

| Property              | Value                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| **Line range**        | L723-770 (form L726-746, list L749-768)                                                            |
| **Data dependencies** | `/categories` (GET), `/categories` (POST/PUT), `/categories/{id}` (DELETE)                         |
| **State**             | `editingCategory`, `catName`, `catEmoji`, `catDesc`, `catSort`                                     |
| **Description**       | CRUD for product categories with name/emoji/description/sort-order form; form is super_admin-only. |

### 3. Admins Page

| Property              | Value                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Line range**        | L773-815 (form L776-797, list L798-813)                                                                             |
| **Data dependencies** | `/admins` (GET), `/admins` (POST), `/admins/{id}` (DELETE)                                                          |
| **State**             | `adminId`, `adminRole`, `adminCatId`                                                                                |
| **Description**       | Add new admins by Telegram ID with role selection; list and remove existing admins. Entire tab is super_admin-only. |

### 4. Branches Page

| Property              | Value                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Line range**        | L818-862 (form L821-845, list L846-860)                                                                        |
| **Data dependencies** | `/branches` (GET), `/branches` (POST/PUT), `/branches/{id}` (DELETE)                                           |
| **State**             | `editingBranch`, `branchName`, `branchAddress`, `branchPhone`, `branchLocation`, `branchHours`, `branchActive` |
| **Description**       | CRUD for physical branch locations with address/phone/hours/active toggle. Entire tab is super_admin-only.     |

### 5. Content Page

| Property              | Value                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Line range**        | L865-917 (About Us form L870-881, FAQ form L888-901, FAQ list L902-914)                                                             |
| **Data dependencies** | `/settings` (GET, for `about` key), `/settings` (POST, for About Us save), `/faqs` (GET), `/faqs` (POST/PUT), `/faqs/{id}` (DELETE) |
| **State**             | `editingFaq`, `faqQuestion`, `faqAnswer` (also reads/writes `settings` for the `about` key)                                         |
| **Description**       | Content management: edit "About Us" text and manage FAQ entries. Entire tab is super_admin-only.                                    |

### 6. Settings Page

| Property              | Value                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Line range**        | L920-1003                                                                                                                                                                 |
| **Data dependencies** | `/settings` (GET), `/settings` (POST), `/settings/{key}` (DELETE)                                                                                                         |
| **State**             | `newSettingKey`, `newSettingValue` (also reads/writes `settings` array for instagram, phone, price_unit, ai_greeting keys and custom settings)                            |
| **Description**       | Edit bot configuration: built-in keys (Instagram URL, Contact Phone, Price Unit, AI Greeting), custom key-value settings with add/delete. Entire tab is super_admin-only. |

### 7. Menu Config Page

| Property              | Value                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Line range**        | L1006-1089                                                                                                                                                                                                         |
| **Data dependencies** | `/menu-config` (GET), `/menu-config/{id}` (PUT, toggle visibility), `/menu-config/reorder` (POST), `/menu-config/{id}` (DELETE), `/menu-config` (POST, add to section), `/menu-config/{id}` (PUT, special message) |
| **State**             | `menuActiveSection`, `menuAddCatId`, `editingSpecialMsg`, `specialMsgValue` (also reads `menuConfigs` and `categories`)                                                                                            |
| **Description**       | Configure the Telegram bot's inline menu: section tabs (drinks/beans/cakes/extras), reorder categories within sections, toggle visibility, edit per-category special messages. Entire tab is super_admin-only.     |

---

## Section 6 — Tabs vs Roles

| Tab            | Key          | super_admin | category_admin |
| -------------- | ------------ | ----------- | -------------- |
| Products       | `products`   | Yes         | Yes            |
| Categories     | `categories` | Yes         | Yes            |
| Settings       | `settings`   | Yes         | No             |
| Branches       | `branches`   | Yes         | No             |
| Content (FAQs) | `content`    | Yes         | No             |
| Admins         | `admins`     | Yes         | No             |
| Menu Config    | `menu`       | Yes         | No             |

**Role-based filtering is governed by:**

- **Tab content visibility:** Each tab body is guarded by `isSuperAdmin &&` (except Products at L593 and Categories at L723, which render for both roles).
  - Products: L593 `{activeTab === 'products' && (` -- no role gate on the tab itself, but the add/edit form at L595 is guarded by `{(isSuperAdmin || allowedCatId) && (`.
  - Categories: L723 `{activeTab === 'categories' && (` -- no role gate on the tab itself, but the add/edit form at L725 is guarded by `{isSuperAdmin && (`.
  - Admins: L773 `{activeTab === 'admins' && isSuperAdmin && (`
  - Branches: L818 `{activeTab === 'branches' && isSuperAdmin && (`
  - Content: L865 `{activeTab === 'content' && isSuperAdmin && (`
  - Settings: L920 `{activeTab === 'settings' && isSuperAdmin && (`
  - Menu: L1006 `{activeTab === 'menu' && isSuperAdmin && (`

- **Bottom nav buttons:** L1091-1118. Products and Categories buttons (L1093-1098) are always rendered. The remaining 5 tabs (Settings, Branches, Content, Admins, Menu) are wrapped in `{isSuperAdmin && (<> ... </>)}` at L1099-1117.

---

## Section 7 — Pre-split Invariants

1. **Hardcoded API base URL** (`L3`): `const API_BASE = 'https://azadi-coffee-bot.zahedrastgar316.workers.dev/api'` must not change. This is the same Worker serving both the bot and the admin API at `/api/*`.

2. **Authorization header pattern** (`L101-104`): Every request must send `Authorization: Telegram ${getInitData()}` using `retrieveLaunchParams()` from `@telegram-apps/sdk`. The `getInitData()` helper and the `headers` object must remain identical.

3. **Persian data elements get `dir="auto"`, chrome stays English**: Product names, category names, descriptions, FAQ questions/answers, branch addresses etc. must continue to have `dir="auto"` on their elements. All UI chrome (labels, buttons, headings) stays English per AGENTS.md convention.

4. **Every list renders an `.empty-state` block when empty**: The pattern `{items.length === 0 && !loading && <div className="empty-state">No X yet.</div>}` must be preserved for Products, Categories, Admins, Branches, and FAQs lists.

5. **Monolithic `fetchData` currently ensures atomic user-data-then-resource loading**: On mount, `fetchData` first fetches `/currentUser` to determine the role, then conditionally fetches super_admin-only resources. After split, each page component must independently handle the case where `currentUser` is not yet loaded (e.g., via a shared context or loading gate) to avoid race conditions where a super_admin-only page renders before role is known.
