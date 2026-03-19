import { Avatar, Box, Divider, Typography } from "@mui/material";

export const InmatePanel = ({ inmate }) => {
    
  const fullName = [inmate?.firstName, inmate?.lastName].filter(Boolean).join(" ") || "-";

  const profileSrc = (() => {
    const pic = inmate?.pro_pic?.file_url; // if you add later
    if (!pic) return "";
    if (typeof pic === "string" && pic.startsWith("http")) return pic;
    if (typeof pic === "string") return `${import.meta.env.VITE_API_URL}${pic}`;
    return "";
  })();

  return (
    <Box className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-4">
        <Avatar src={profileSrc || undefined} alt={fullName} sx={{ width: 64, height: 64 }}>
          {(fullName?.[0] || "I").toUpperCase()}
        </Avatar>

        <div className="min-w-0">
          <Typography variant="h6" className="font-bold truncate">
            {fullName}
          </Typography>

          <Typography variant="body2" className="text-gray-600">
            ID: <span className="font-semibold">{inmate?.inmateId || "-"}</span>
          </Typography>

          {/* <Typography variant="body2" className="text-gray-600">
            Location:{" "}
            <span className="font-semibold">{inmate?.location_id?.locationName || "-"}</span>
          </Typography> */}
        </div>
      </div>

      <Divider className="my-4" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        <InfoItem label="Status" value={inmate?.status} />
        <InfoItem label="Custody Type" value={inmate?.custodyType} />
        <InfoItem label="Phone Number" value={inmate?.phonenumber} />
        <InfoItem label="Cell Number" value={inmate?.cellNumber} />
        <InfoItem label="Balance" value={typeof inmate?.balance === "number" ? `₹${inmate.balance}` : "-"} />
        <InfoItem label="DOB" value={inmate?.dateOfBirth ? formatDate(inmate.dateOfBirth) : "-"} />
        <InfoItem label="Admission Date" value={inmate?.admissionDate ? formatDate(inmate.admissionDate) : "-"} />
        <InfoItem label="Blocked" value={String(inmate?.is_blocked ?? "-")} />
      </div>
    </Box>
  );
};

const InfoItem = ({ label, value }) => (
  <div className="bg-gray-50 rounded-xl px-3 p-1 flex flex-row md:flex-col items-center md:items-start gap-3 md:gap-1">
    <Typography variant="caption" className="text-gray-500">
      {label}
    </Typography>
    <Typography variant="body2" className="font-semibold text-gray-900">
      {value || "-"}
    </Typography>
  </div>
);

const formatDate = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
};
