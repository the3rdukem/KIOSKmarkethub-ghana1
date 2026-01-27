import { redirect } from 'next/navigation';

interface ProductsRedirectProps {
  params: Promise<{ id: string }>;
}

export default async function ProductsRedirect({ params }: ProductsRedirectProps) {
  const { id } = await params;
  redirect(`/product/${id}`);
}
