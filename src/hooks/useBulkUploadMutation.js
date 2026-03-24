import { useMutation } from "@tanstack/react-query";
import { downloadSampleCsv, uploadStudentsBulk } from "../service/bulkOperationService";

export const useBulkUploadStudentsMutation = () =>
  useMutation({
    mutationFn: uploadStudentsBulk,
  });

  export const useDownloadSampleCsvMutation = () =>
  useMutation({
    mutationFn: downloadSampleCsv,
  });