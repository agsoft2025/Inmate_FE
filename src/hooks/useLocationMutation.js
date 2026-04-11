import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLocation, getLocations, saveBackupConfig, updateLocation } from "../service/locationService";

export const useLocationsQuery = (enabled, userId) =>
  useQuery({
    queryKey: ["locations", userId],
    queryFn: getLocations,
    enabled: Boolean(enabled && userId), // only run when user context ready
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });

export const useLocationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ isEdit, selectedLocation, payload }) => {
      if (isEdit) {
        return updateLocation({
          id: selectedLocation._id,
          payload,
        });
      }
      return createLocation(payload);
    },

    onSuccess: async () => {
      // ✅ this will trigger getLocations again
      await queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
  });
};

  // DB
  export const useSaveBackupMutation = () =>
  useMutation({
    mutationFn: saveBackupConfig,
  });
