import { getReferralCreditsByUserId } from '@/lib/referrals/storage';

function formatCurrencyFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function ReferralEarningsSection({ userId }: { userId: string }) {
  const credits = await getReferralCreditsByUserId(userId);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Referral Earnings</h2>
      </div>

      {credits.length === 0 ? (
        <div className="text-sm text-gray-600">No referrals yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b border-gray-200">
                <th className="py-2 pr-4 font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {credits.map((c) => (
                <tr key={c.id} className="text-gray-900">
                  <td className="py-3 pr-4 font-medium">{formatCurrencyFromCents(c.amountCents)}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        c.status === 'completed'
                          ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200'
                          : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
                      ].join(' ')}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-700">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

