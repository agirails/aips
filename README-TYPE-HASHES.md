# Quick Reference: EIP-712 Type Hashes

**Generated:** 2025-11-24
**Status:** ✅ Production Ready

---

## Type Hashes (Copy-Paste Ready)

```typescript
// AIP-0.1: Notification
export const NOTIFICATION_TYPE_HASH = '0xa02f2574276a8ca75bfdad3fc381f36324358b535685db9f507708ee9490c8e9';

// AIP-1: Request
export const REQUEST_TYPE_HASH = '0x445f1b6560f0d4302d32fa3677ce3a4130fcd347b333c333f78e2725d42b12c7';

// AIP-2: Quote
export const QUOTE_REQUEST_TYPE_HASH = '0x3a250619f2f54b815ae7a1b3219f8a958f9cde40186233bee134b4b9d7095407';

// AIP-3: Discovery
export const DISCOVERY_TYPE_HASH = '0x34e59475223edfc59d786cb2f8c921a61f2bf4cf7f64bc28b847f9448d16e7a2';

// AIP-4: Delivery
export const DELIVERY_PROOF_TYPE_HASH = '0x7974f677eb16e762b690ee2ec91d75e28a770e2a1ea6fea824eddff6ea9a855b';

// AIP-5: Dispute
export const DISPUTE_TYPE_HASH = '0x118a9fe5aef5b766734aa976f70c90a40c4c1144c599a0405a60c18199f9ee66';

// AIP-6: Resolution
export const RESOLUTION_TYPE_HASH = '0x4312d59902c52428cc3c348e24d4b7b3922b50e0e2c9f8a16ee504f5ec6d1fc2';
```

---

## Files Created

1. **`compute-type-hashes.js`** - Verification script (Node.js)
2. **`eip712-type-definitions.ts`** - Complete TypeScript definitions for SDK
3. **`EIP-712-TYPE-HASHES-SUMMARY.md`** - Comprehensive documentation
4. **`README-TYPE-HASHES.md`** - This quick reference

---

## Verification

```bash
node compute-type-hashes.js
```

---

## Integration Checklist

- [x] Compute all 7 type hashes
- [x] Update AIP-0.md §5.2 table
- [x] Create TypeScript type definitions
- [x] Create verification script
- [ ] Integrate into `@agirails/sdk`
- [ ] Add to smart contracts (optional, for verification)
- [ ] Create JSON schema files
- [ ] Write integration tests
- [ ] Deploy to mainnet

---

**Reference:** AIP-0.md lines 827-835
