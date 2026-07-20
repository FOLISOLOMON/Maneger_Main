// Veloura Manager V2 — Wallets page
// Spec section 7.15 + 3.12. Three wallet cards (Needs, Savings, Growth)
// with balance, income, outflow. Transaction history per wallet. Withdrawal
// and transfer create wallet_transactions rows (balances are derived).

import { useMemo, useState } from 'react';
import { Wallet, PiggyBank, TrendingUp, ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../../contexts/AppContext';
import { useWalletsSnapshot, useCreateWalletTransaction } from '../../hooks/queries';
import { walletBalances } from '../../services/calculations';
import { formatMoney, formatMoneyCompact, formatRelative } from '../../utils/format';
import { Card, EmptyState, LoadingState, ErrorState, SectionHeader, Badge } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Field, Input, Select, Textarea } from '../../components/common/Form';
import { useFabRegistration } from '../../components/layout/AppLayout';
import { useToast } from '../../components/common/Toast';
import { WALLET_META } from '../../constants';
import type { WalletName } from '../../types';

const WALLET_ICONS = { Needs: Wallet, Savings: PiggyBank, Growth: TrendingUp };

export function Wallets() {
  const { currencySymbol } = useApp();
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const { data: snapshot, isLoading, isError, refetch } = useWalletsSnapshot({ walletTxLimit: PAGE_SIZE });
  const tx = snapshot?.walletTx;
  const [activeWallet, setActiveWallet] = useState<WalletName>('Needs');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const createTx = useCreateWalletTransaction();
  const toast = useToast();

  useFabRegistration({ label: 'Transfer', icon: ArrowRightLeft, onClick: () => setTransferOpen(true) });

  const balances = useMemo(() => walletBalances(tx ?? []), [tx]);
  const allWalletTxs = useMemo(() => (tx ?? []).filter((t) => t.wallet === activeWallet), [tx, activeWallet]);
  const visibleTxs = allWalletTxs.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = allWalletTxs.length > visibleTxs.length;

  const loadMore = () => setPage((p) => p + 1);

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Couldn't load wallets" onRetry={() => refetch()} />;

  const active = balances.find((b) => b.wallet === activeWallet)!;

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionHeader title="Wallets" subtitle="Virtual profit allocations" />

      {/* Wallet cards */}
      <div className="grid grid-cols-1 gap-3">
        {balances.map((w) => {
          const meta = WALLET_META[w.wallet];
          const Icon = WALLET_ICONS[w.wallet];
          const isActive = w.wallet === activeWallet;
          return (
            <button key={w.wallet} onClick={() => setActiveWallet(w.wallet)} className="text-left">
              <Card padding="md" className={clsx('transition-all', isActive && 'ring-2 ring-accent ring-offset-1')}>
                <div className="flex items-center gap-3">
                  <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0', meta.bg)}>
                    <Icon className={clsx('w-6 h-6', meta.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-secondary">{meta.label}</p>
                    <p className="text-2xl font-display font-extrabold text-text-primary tabular-nums">{formatMoney(w.balance, currencySymbol)}</p>
                  </div>
                  <div className="text-right text-xs space-y-0.5 flex-shrink-0">
                    <p className="text-success font-semibold tabular-nums">+{formatMoneyCompact(w.income, currencySymbol)}</p>
                    <p className="text-danger font-semibold tabular-nums">-{formatMoneyCompact(w.outflow, currencySymbol)}</p>
                  </div>
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Active wallet detail */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-text-primary">{WALLET_META[activeWallet].label} Transactions</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setWithdrawOpen(true)}>
            <ArrowDownLeft className="w-4 h-4" /> Withdraw
          </Button>
          <Button size="sm" variant="primary" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="w-4 h-4" /> Transfer
          </Button>
        </div>
      </div>

      {visibleTxs.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<Wallet className="w-7 h-7" />}
            title="No transactions yet"
            description={`Wallet allocations from completed batches and withdrawals will appear here.`}
          />
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {visibleTxs.map((t) => {
              const isOutflow = ['Expense', 'Withdrawal'].includes(t.transaction_type);
              return (
                <Card key={t.id} padding="sm" className="flex items-center gap-3">
                  <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', isOutflow ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success')}>
                    {isOutflow ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{t.reason ?? t.transaction_type}</p>
                    <p className="text-xs text-text-muted">
                      {t.transaction_code} · {formatRelative(t.created_at)}
                      {t.batch_id && ' · batch allocation'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={clsx('text-sm font-bold tabular-nums', isOutflow ? 'text-danger' : 'text-success')}>
                      {isOutflow ? '-' : '+'}{formatMoney(t.amount, currencySymbol)}
                    </p>
                    <Badge color="bg-surface-alt text-text-secondary">{t.transaction_type}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
          {hasMore && (
            <div className="text-center pt-2">
              <Button variant="outline" onClick={loadMore}>Load more transactions</Button>
            </div>
          )}
        </>
      )}

      <WalletActionModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Withdraw Funds"
        subtitle={`From ${activeWallet} wallet`}
        actionType="Withdrawal"
        wallet={activeWallet}
        currencySymbol={currencySymbol}
        balance={active.balance}
        loading={createTx.isPending}
        onSubmit={async (payload) => {
          try {
            await createTx.mutateAsync(payload);
            toast('Withdrawal recorded', 'success');
            setWithdrawOpen(false);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed';
            toast(message, 'error');
          }
        }}
      />

      <WalletActionModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Transfer Funds"
        subtitle="Move money between wallets"
        actionType="Transfer"
        wallet={activeWallet}
        currencySymbol={currencySymbol}
        balance={active.balance}
        showTargetWallet
        loading={createTx.isPending}
        onSubmit={async (payload) => {
          try {
            // Create outflow from source + inflow to target
            await createTx.mutateAsync({ ...payload, transaction_type: 'Transfer' });
            if (payload.target_wallet) {
              await createTx.mutateAsync({
                wallet: payload.target_wallet,
                transaction_type: 'Transfer',
                amount: payload.amount,
                reason: `Transfer from ${payload.wallet}`,
              });
            }
            toast('Transfer completed', 'success');
            setTransferOpen(false);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed';
            toast(message, 'error');
          }
        }}
      />
    </div>
  );
}

interface WalletActionModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  actionType: 'Withdrawal' | 'Transfer';
  wallet: WalletName;
  currencySymbol: string;
  balance: number;
  loading: boolean;
  showTargetWallet?: boolean;
  onSubmit: (payload: {
    wallet: WalletName;
    transaction_type: 'Allocation' | 'Expense' | 'Transfer' | 'Withdrawal' | 'Adjustment';
    amount: number;
    reason: string;
    target_wallet?: WalletName;
  }) => void;
}

function WalletActionModal({ open, onClose, title, subtitle, actionType, wallet, currencySymbol, balance, loading, showTargetWallet, onSubmit }: WalletActionModalProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [targetWallet, setTargetWallet] = useState<WalletName>('Savings');
  const toast = useToast();

  const reset = () => { setAmount(''); setReason(''); setTargetWallet('Savings'); };

  const submit = () => {
    const amt = Number(amount) || 0;
    if (amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    if (amt > balance) { toast(`Insufficient funds. Balance is ${formatMoney(balance, currencySymbol)}`, 'error'); return; }
    if (!reason.trim()) { toast('A reason is required', 'error'); return; }
    onSubmit({
      wallet,
      transaction_type: actionType,
      amount: amt,
      reason: reason.trim(),
      target_wallet: showTargetWallet ? targetWallet : undefined,
    });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={loading}>{actionType === 'Withdrawal' ? 'Withdraw' : 'Transfer'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-alt p-3 flex justify-between items-center">
          <span className="text-sm text-text-secondary">Available balance</span>
          <span className="font-display font-bold text-text-primary tabular-nums">{formatMoney(balance, currencySymbol)}</span>
        </div>
        <Field label="Amount" required>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
        </Field>
        {showTargetWallet && (
          <Field label="To wallet" required>
            <Select value={targetWallet} onChange={(e) => setTargetWallet(e.target.value as WalletName)}>
              {(['Needs', 'Savings', 'Growth'] as WalletName[]).filter((w) => w !== wallet).map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Reason" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`Why are you ${actionType === 'Withdrawal' ? 'withdrawing' : 'transferring'} these funds?`} />
        </Field>
      </div>
    </Modal>
  );
}
