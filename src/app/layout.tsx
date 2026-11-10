import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'عقار إيليت — نظام إدارة المبيعات العقارية بالتقسيط',
  description: 'نظام متعدد الشركات لإدارة الوحدات العقارية والحجوزات والعقود والأقساط',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
