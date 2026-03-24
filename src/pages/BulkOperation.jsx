import { Button, Card, CardContent, CircularProgress } from "@mui/material";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useSnackbar } from "notistack";
import { useBulkUploadStudentsMutation, useDownloadSampleCsvMutation } from "../hooks/useBulkUploadMutation";
import { useLocationCtx } from "../context/LocationContext";

const BulkOperation = ({ location }) => {
    const { enqueueSnackbar } = useSnackbar();

    const inmateInputRef = useRef(null);
    const [selectedInmateFile, setSelectedInmateFile] = useState(null);

    const uploadMutation = useBulkUploadStudentsMutation();
    const downloadCsvMutation = useDownloadSampleCsvMutation();
    const { selectedLocation } = useLocationCtx();

    const handleDownloadSampleCSV = async () => {
        if (!selectedLocation?._id) {
            enqueueSnackbar("Location not found", { variant: "error" });
            return;
        }

        try {
            const blob = await downloadCsvMutation.mutateAsync({
                type: "inmate",
                locationId: selectedLocation._id,
            });

            const fileName = "inmate_sample.csv";

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            enqueueSnackbar("Sample CSV downloaded", { variant: "success" });
        } catch (err) {
            enqueueSnackbar(
                err?.response?.data?.message || "Failed to download CSV file",
                { variant: "error" }
            );
        }
    };


    const handleInmateFileUpload = async (e) => {
        const file = e.target.files?.[0];
        setSelectedInmateFile(file);

        if (!file) {
            enqueueSnackbar("Please select a file.", { variant: "error" });
            return;
        }

        if (!selectedLocation?._id) {
            enqueueSnackbar("Location is missing.", { variant: "error" });
            return;
        }

        try {
            const payload = await uploadMutation.mutateAsync({
                locationId: selectedLocation._id,
                file,
            });

            if (!payload?.success) {
                enqueueSnackbar(payload?.message || "Upload failed.", { variant: "error" });
            } else {
                const created = payload?.results?.created?.length ?? 0;
                const alreadyExists = payload?.results?.alreadyExists?.length ?? 0;
                const failed = payload?.results?.failed?.length ?? 0;
                
                enqueueSnackbar(
                    `Upload successful. Created: ${created}, Already Exists: ${alreadyExists}, Failed: ${failed}`,
                    { variant: "success" }
                );

                if (failed > 0) {
                    console.warn("Failed records:", payload?.results?.failed);
                    // Optionally show more detailed error for failed records
                    payload?.results?.failed?.forEach((record, index) => {
                        console.warn(`Failed record ${index + 1}:`, record);
                    });
                }
            }
        } catch (err) {
            enqueueSnackbar(err?.message || "Upload failed. Check console for details.", {
                variant: "error",
            });
        } finally {
            setSelectedInmateFile(null);
            if (inmateInputRef.current) inmateInputRef.current.value = null;
        }
    };

    return (
        <div className="mx-4">
            <div className="flex justify-between flex-col md:flex-row">
                <div>
                    <h1 className="text-2xl font-bold">Bulk Operations</h1>
                    <h3 className="text-md md:text-lg py-3 md:py-0">
                        Upload CSV files to add multiple inmates in bulk
                    </h3>
                </div>
                <Button
                    variant="outlined"
                    onClick={handleDownloadSampleCSV}
                    disabled={downloadCsvMutation.isPending}
                    sx={{height: "45px"}}
                    className="bg-primary! text-white!"
                >
                    {downloadCsvMutation.isPending ? "Downloading..." : "Download Sample CSV"}
                </Button>
            </div>


            <div className="my-4">
                <Card className="bg-blue-50! border-blue-200! rounded-2xl!">
                    <CardContent className="px-4">
                        <h3 className="font-semibold text-blue-900 mb-4">CSV Format Requirements:</h3>
                        <ul className="space-y-2 text-blue-800">
                            <li className="flex items-start">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 shrink-0"></span>
                                <span>Headers: inmateNumber, firstName, lastName, balance, status</span>
                            </li>
                            <li className="flex items-start">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 shrink-0"></span>
                                <span>status should be either 'active' or 'inactive'</span>
                            </li>
                            <li className="flex items-start">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 shrink-0"></span>
                                <span>balance should be a number (can be 0)</span>
                            </li>
                            <li className="flex items-start">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 shrink-0"></span>
                                <span>All fields are required</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Upload CSV File</h3>

                <div className="flex items-center gap-4">
                    <input
                        ref={inmateInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={handleInmateFileUpload}
                        className="hidden"
                    />

                    <Button
                        variant="outlined"
                        onClick={() => inmateInputRef.current?.click()}
                        disabled={uploadMutation.isPending}
                        className="flex items-center gap-2 cursor-pointer border border-primary!"
                    >
                        {uploadMutation.isPending ? (
                            <CircularProgress size={18} />
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        {uploadMutation.isPending ? "Uploading..." : "Choose File"}
                    </Button>

                    {selectedInmateFile?.name && (
                        <p className="text-sm text-gray-600">{selectedInmateFile.name}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkOperation;
