import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import type { ProductRow } from '../api/types';

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
