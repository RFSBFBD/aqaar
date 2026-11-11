type BadgeVariant = 'green' | 'amber' | 'red' | 'neutral';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green: 'bg-[#ECFDF5] text-[#15803D] border-[#BBF7D0]',
  amber: 'bg-[#FEFCE8] text-[#A16207] border-[#FDE68A]',
  red: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
  neutral: 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]',
};

export function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: BadgeVariant;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-semibold ${VARIANT_CLASSES[variant]}`}
    >
      {label}
    </span>
  );
}

export function unitStatusBadge(status: 'AVAILABLE' | 'RESERVED' | 'SOLD') {
  switch (status) {
    case 'AVAILABLE':
      return <StatusBadge label="متاحة" variant="green" />;
    case 'RESERVED':
      return <StatusBadge label="محجوزة" variant="amber" />;
    case 'SOLD':
      return <StatusBadge label="مباعة" variant="neutral" />;
  }
}

export function reservationStatusBadge(status: 'ACTIVE' | 'EXPIRED' | 'CONVERTED') {
  switch (status) {
    case 'ACTIVE':
      return <StatusBadge label="نشط" variant="amber" />;
    case 'EXPIRED':
      return <StatusBadge label="منتهي" variant="red" />;
    case 'CONVERTED':
      return <StatusBadge label="محوّل لعقد" variant="green" />;
  }
}

export function contractStatusBadge(status: 'DRAFT' | 'APPROVED') {
  switch (status) {
    case 'DRAFT':
      return <StatusBadge label="مسودة" variant="amber" />;
    case 'APPROVED':
      return <StatusBadge label="معتمد" variant="green" />;
  }
}

export function installmentStatusBadge(
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'
) {
  switch (status) {
    case 'PENDING':
      return <StatusBadge label="قيد الانتظار" variant="neutral" />;
    case 'PARTIAL':
      return <StatusBadge label="مدفوع جزئياً" variant="amber" />;
    case 'PAID':
      return <StatusBadge label="مدفوع بالكامل" variant="green" />;
    case 'OVERDUE':
      return <StatusBadge label="متأخر" variant="red" />;
  }
}
