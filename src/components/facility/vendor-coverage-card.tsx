import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ContractStateBadge } from "@/components/facility/vendor-badges";
import { formatDate } from "@/lib/format";
import { contractExpiryState } from "@/lib/types/vendors";
import type { AssetVendorCoverage } from "@/lib/queries/vendors";

/**
 * Renders the vendor / service coverage for an asset (§18). Renders nothing
 * when there is no coverage, so it never shows an empty section.
 */
export function VendorCoverageCard({ coverage }: { coverage: AssetVendorCoverage[] }) {
  if (!coverage || coverage.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Vendor / Service Coverage</h3>
        <div className="divide-y divide-slate-100">
          {coverage.map((c) => (
            <div key={c.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  {c.vendor ? (
                    <Link href={`/vendors/${c.vendor.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                      {c.vendor.company_name}
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-500">Unknown vendor</span>
                  )}
                  {c.relationship_type && <span className="ml-2 text-xs text-slate-500">{c.relationship_type}</span>}
                </div>
                {c.contract && <ContractStateBadge state={contractExpiryState(c.contract.status, c.contract.end_date)} />}
              </div>
              {c.contract && (
                <p className="mt-1 text-xs text-slate-500">
                  <Link href={`/vendors/contracts/${c.contract.id}`} className="hover:underline">{c.contract.contract_number}</Link>
                  {" — "}{c.contract.name}{" · expires "}{formatDate(c.contract.end_date)}
                </p>
              )}
              {c.vendor && (c.vendor.phone || c.vendor.mobile) && (
                <p className="mt-1 text-xs text-slate-500">
                  Call:{" "}
                  {c.vendor.phone && <a href={`tel:${c.vendor.phone}`} className="text-blue-700 hover:underline">{c.vendor.phone}</a>}
                  {c.vendor.phone && c.vendor.mobile ? " · " : ""}
                  {c.vendor.mobile && <a href={`tel:${c.vendor.mobile}`} className="text-blue-700 hover:underline">{c.vendor.mobile}</a>}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
