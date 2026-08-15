import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import type { ProductRow } from '../api/types';
import type { ProductFormData } from '../components/ProductFormDrawer';

interface ToggleArgs {
  id: number;
  field: string;
  value: boolean | number;
}

export function useToggleProductField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, field, value }: ToggleArgs) =>
      field === 'available'
        ? apiFetch(`/products/${id}/toggle`, { method: 'PUT', body: { available: value } })
        : apiFetch(`/products/${id}`, { method: 'PUT', body: { [field]: value } }),
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products });
      const prev = queryClient.getQueryData<ProductRow[]>(queryKeys.products);
      queryClient.setQueryData<ProductRow[]>(queryKeys.products, (old) =>
        old?.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
      );
      return { prev };
    },
    onError: (_err, _vars, context: { prev?: ProductRow[] } | undefined) => {
      if (context?.prev) queryClient.setQueryData(queryKeys.products, context.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
}

export function useSaveProduct({
  onSuccess,
  onError,
}: {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
} = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      method: string;
      id?: number;
      body: ProductFormData;
      imageUrl?: string | null;
    }) => {
      const result = await apiFetch<{ success: boolean }>(
        data.id ? `/products/${data.id}` : '/products',
        { method: data.method, body: data.body },
      );
      if (data.id && data.imageUrl !== undefined) {
        if (data.imageUrl) {
          await apiFetch(`/products/${data.id}/image`, {
            method: 'PUT',
            body: { imageUrl: data.imageUrl },
          });
        } else if (data.body.imageUrl === null) {
          await apiFetch(`/products/${data.id}/image`, {
            method: 'DELETE',
          });
        }
      }
      return result;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      onSuccess?.(variables.id ? 'محصول به‌روزرسانی شد ✓' : 'محصول اضافه شد ✓');
    },
    onError: (err: Error) => {
      onError?.(err.message);
    },
  });
}
