# Onboarding Individual Save Requirements

## Overview
Convert steps 3-8 (name, bio, traits, owns_business, contact, location) to save individually like the username step, rather than saving all at once at the review step.

## Current State

### Username Step (Reference Implementation)
- **Saves individually** with "Confirm Username" button
- **State management:**
  - `usernameSaved` - boolean
  - `savingUsername` - boolean
  - `usernameSaveError` - string | null
  - `usernameEditing` - boolean
  - `usernameAvailable` - boolean | null
  - `usernameFormatValid` - boolean | null
- **Save function:** `saveUsername(username: string)` - calls `AccountService.updateCurrentAccount({ username })`
- **UI states:**
  - Confirmed: Shows saved value with checkmark + "Edit" button
  - Editing: Shows input + "Confirm Username" button
- **Auto-initialization:** `useEffect` loads existing value when entering step
- **Footer:** Special handling in `OnboardingFooter` with disabled state logic

### Other Steps (Current - Need Conversion)
- **Save together** at review step via `handleSubmit()`
- **State:** Only `formData` state (no individual save states)
- **No individual save functions**
- **No confirmed/editing states**
- **Footer:** Generic "Continue" button that just advances step

## Required Changes Per Step

### 1. Name Step (`name`)

**Fields:** `first_name`, `last_name`

**State to add:**
```typescript
const [nameSaved, setNameSaved] = useState(false);
const [savingName, setSavingName] = useState(false);
const [nameSaveError, setNameSaveError] = useState<string | null>(null);
const [nameEditing, setNameEditing] = useState(false);
```

**Save function:**
```typescript
const saveName = async (firstName: string, lastName: string) => {
  if (!account?.id) return;
  
  setSavingName(true);
  setNameSaveError(null);
  
  try {
    await AccountService.updateCurrentAccount({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
    }, account.id);
    
    const updatedAccount = await AccountService.getCurrentAccount();
    if (updatedAccount) {
      setAccount(updatedAccount);
      setNameSaved(true);
      setNameEditing(false);
    }
  } catch (err) {
    setNameSaveError(err instanceof Error ? err.message : 'Failed to save name');
    setNameSaved(false);
  } finally {
    setSavingName(false);
  }
};
```

**UI changes:**
- Add confirmed state: Show saved name with checkmark + "Edit" button
- Add editing state: Show inputs + "Confirm Name" button
- Initialize from `account.first_name` and `account.last_name` when entering step

**Footer changes:**
- Add to `OnboardingFooter` special handling
- Disable "Continue" until name is saved (or allow skipping if optional)
- Show "Confirm Name" button when editing

---

### 2. Bio Step (`bio`)

**Fields:** `bio` (max 240 chars)

**State to add:**
```typescript
const [bioSaved, setBioSaved] = useState(false);
const [savingBio, setSavingBio] = useState(false);
const [bioSaveError, setBioSaveError] = useState<string | null>(null);
const [bioEditing, setBioEditing] = useState(false);
```

**Save function:**
```typescript
const saveBio = async (bio: string) => {
  if (!account?.id) return;
  
  setSavingBio(true);
  setBioSaveError(null);
  
  try {
    await AccountService.updateCurrentAccount({
      bio: bio.trim() || null,
    }, account.id);
    
    const updatedAccount = await AccountService.getCurrentAccount();
    if (updatedAccount) {
      setAccount(updatedAccount);
      setBioSaved(true);
      setBioEditing(false);
    }
  } catch (err) {
    setBioSaveError(err instanceof Error ? err.message : 'Failed to save bio');
    setBioSaved(false);
  } finally {
    setSavingBio(false);
  }
};
```

**UI changes:**
- Confirmed state: Show saved bio text with checkmark + "Edit" button
- Editing state: Show textarea + "Confirm Bio" button
- Character counter (already exists)
- Initialize from `account.bio` when entering step

**Footer changes:**
- Allow skipping (bio is optional)
- Show "Confirm Bio" when editing
- "Continue" enabled even if not saved (optional field)

---

### 3. Traits Step (`traits`)

**Fields:** `traits` (array of TraitId)

**State to add:**
```typescript
const [traitsSaved, setTraitsSaved] = useState(false);
const [savingTraits, setSavingTraits] = useState(false);
const [traitsSaveError, setTraitsSaveError] = useState<string | null>(null);
const [traitsEditing, setTraitsEditing] = useState(false);
```

**Save function:**
```typescript
const saveTraits = async (traits: TraitId[]) => {
  if (!account?.id) return;
  
  setSavingTraits(true);
  setTraitsSaveError(null);
  
  try {
    await AccountService.updateCurrentAccount({
      traits: traits.length > 0 ? (traits as AccountTrait[]) : null,
    }, account.id);
    
    const updatedAccount = await AccountService.getCurrentAccount();
    if (updatedAccount) {
      setAccount(updatedAccount);
      setTraitsSaved(true);
      setTraitsEditing(false);
    }
  } catch (err) {
    setTraitsSaveError(err instanceof Error ? err.message : 'Failed to save traits');
    setTraitsSaved(false);
  } finally {
    setSavingTraits(false);
  }
};
```

**UI changes:**
- Confirmed state: Show selected traits as chips with checkmark + "Edit" button
- Editing state: Show trait selection buttons + "Confirm Traits" button
- Initialize from `account.traits` when entering step

**Footer changes:**
- Allow skipping (traits are optional)
- Show "Confirm Traits" when editing
- "Continue" enabled even if not saved

---

### 4. Owns Business Step (`owns_business`)

**Fields:** `owns_business` (boolean | null)

**State to add:**
```typescript
const [ownsBusinessSaved, setOwnsBusinessSaved] = useState(false);
const [savingOwnsBusiness, setSavingOwnsBusiness] = useState(false);
const [ownsBusinessSaveError, setOwnsBusinessSaveError] = useState<string | null>(null);
const [ownsBusinessEditing, setOwnsBusinessEditing] = useState(false);
```

**Save function:**
```typescript
const saveOwnsBusiness = async (ownsBusiness: boolean | null) => {
  if (!account?.id) return;
  
  setSavingOwnsBusiness(true);
  setOwnsBusinessSaveError(null);
  
  try {
    await AccountService.updateCurrentAccount({
      owns_business: ownsBusiness,
    }, account.id);
    
    const updatedAccount = await AccountService.getCurrentAccount();
    if (updatedAccount) {
      setAccount(updatedAccount);
      setOwnsBusinessSaved(true);
      setOwnsBusinessEditing(false);
    }
  } catch (err) {
    setOwnsBusinessSaveError(err instanceof Error ? err.message : 'Failed to save business status');
    setOwnsBusinessSaved(false);
  } finally {
    setSavingOwnsBusiness(false);
  }
};
```

**UI changes:**
- Confirmed state: Show "Yes" or "No" with checkmark + "Edit" button
- Editing state: Show Yes/No buttons + "Confirm" button
- Initialize from `account.owns_business` when entering step

**Footer changes:**
- Allow skipping (optional)
- Show "Confirm" when editing
- "Continue" enabled even if not saved

---

### 5. Contact Step (`contact`)

**Fields:** `email`, `phone`

**State to add:**
```typescript
const [contactSaved, setContactSaved] = useState(false);
const [savingContact, setSavingContact] = useState(false);
const [contactSaveError, setContactSaveError] = useState<string | null>(null);
const [contactEditing, setContactEditing] = useState(false);
```

**Save function:**
```typescript
const saveContact = async (email: string, phone: string) => {
  if (!account?.id) return;
  
  setSavingContact(true);
  setContactSaveError(null);
  
  // Validation: at least one must be provided
  const emailTrimmed = email.trim();
  const phoneTrimmed = phone.trim();
  
  if (!emailTrimmed && !phoneTrimmed) {
    setContactSaveError('Please provide at least one contact method');
    setSavingContact(false);
    return;
  }
  
  // Email format validation
  if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    setContactSaveError('Please enter a valid email address');
    setSavingContact(false);
    return;
  }
  
  // Phone format validation (basic)
  if (phoneTrimmed && !/^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/.test(phoneTrimmed)) {
    setContactSaveError('Please enter a valid phone number');
    setSavingContact(false);
    return;
  }
  
  try {
    await AccountService.updateCurrentAccount({
      email: emailTrimmed || null,
      phone: phoneTrimmed || null,
    }, account.id);
    
    const updatedAccount = await AccountService.getCurrentAccount();
    if (updatedAccount) {
      setAccount(updatedAccount);
      setContactSaved(true);
      setContactEditing(false);
    }
  } catch (err) {
    setContactSaveError(err instanceof Error ? err.message : 'Failed to save contact information');
    setContactSaved(false);
  } finally {
    setSavingContact(false);
  }
};
```

**UI changes:**
- Confirmed state: Show saved email/phone with checkmark + "Edit" button
- Editing state: Show inputs + "Confirm Contact" button
- Show validation errors inline
- Initialize from `account.email` and `account.phone` when entering step

**Footer changes:**
- Allow skipping (optional, but validate if provided)
- Show "Confirm Contact" when editing
- "Continue" enabled even if not saved

---

### 6. Location Step (`location`)

**Fields:** `city_id`

**State to add:**
```typescript
const [locationSaved, setLocationSaved] = useState(false);
const [savingLocation, setSavingLocation] = useState(false);
const [locationSaveError, setLocationSaveError] = useState<string | null>(null);
const [locationEditing, setLocationEditing] = useState(false);
```

**Save function:**
```typescript
const saveLocation = async (cityId: string) => {
  if (!account?.id) return;
  
  setSavingLocation(true);
  setLocationSaveError(null);
  
  try {
    await AccountService.updateCurrentAccount({
      city_id: cityId || null,
    }, account.id);
    
    const updatedAccount = await AccountService.getCurrentAccount();
    if (updatedAccount) {
      setAccount(updatedAccount);
      setLocationSaved(true);
      setLocationEditing(false);
    }
  } catch (err) {
    setLocationSaveError(err instanceof Error ? err.message : 'Failed to save location');
    setLocationSaved(false);
  } finally {
    setSavingLocation(false);
  }
};
```

**UI changes:**
- Confirmed state: Show saved city name with checkmark + "Edit" button
- Editing state: Show city search/select + "Confirm Location" button
- Initialize from `account.city_id` when entering step
- Fetch and display city name from `city_id`

**Footer changes:**
- Allow skipping (optional)
- Show "Confirm Location" when editing
- "Continue" enabled even if not saved

---

## Common Patterns

### 1. Initialize on Step Enter
Each step needs a `useEffect` that:
- Loads existing value from `account` when entering step
- Sets saved state to `true` if value exists
- Syncs `formData` with account value

```typescript
useEffect(() => {
  if (currentStep === 'name') {
    if (account?.first_name || account?.last_name) {
      setFormData(prev => ({
        ...prev,
        first_name: account.first_name || '',
        last_name: account.last_name || '',
      }));
      setNameSaved(true);
      setNameEditing(false);
    } else {
      setNameSaved(false);
      setNameEditing(false);
    }
  }
}, [currentStep, account?.first_name, account?.last_name]);
```

### 2. Reset Editing State on Step Exit
```typescript
useEffect(() => {
  if (currentStep !== 'name') {
    setNameEditing(false);
  }
}, [currentStep]);
```

### 3. Footer Button Logic
Each step needs special handling in `OnboardingFooter`:
- Show "Confirm [Field]" button when editing
- Disable "Continue" until saved (or allow skipping for optional fields)
- Show loading state while saving
- Show error message if save failed

### 4. Update handleSubmit
Remove individual field updates from `handleSubmit()` since they'll be saved individually. Only keep:
- Setting `onboarded: true` flag
- Final account refresh

---

## Implementation Order

1. **Name step** (simplest - two text fields)
2. **Bio step** (text area)
3. **Owns Business step** (boolean selection)
4. **Traits step** (array selection)
5. **Contact step** (two fields + validation)
6. **Location step** (city search/select)

---

## Testing Checklist

For each step:
- [ ] Can save individually with "Confirm" button
- [ ] Shows confirmed state with checkmark after save
- [ ] Can edit saved value with "Edit" button
- [ ] Loads existing value when entering step
- [ ] Shows loading state while saving
- [ ] Shows error message on save failure
- [ ] Can skip (if optional) without saving
- [ ] Footer button states work correctly
- [ ] Account state updates after save
- [ ] Can navigate back/forward without losing unsaved changes

---

## Notes

- All steps except name are **optional** - users can skip without saving
- Name step could be optional too, but currently checks `!account.first_name && !account.last_name` in `determineOnboardingStep`
- Consider making name optional as well for consistency
- Validation should happen in save functions, not just in UI
- Error messages should be user-friendly and actionable
