import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLocation, getLocations, saveBackupConfig, updateLocation } from "../service/locationService";

export const useLocationsQuery = (enabled) =>
  useQuery({
    queryKey: ["locations"],
    queryFn: getLocations,
    enabled,       // only run after login
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
