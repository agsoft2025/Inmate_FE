import React from "react";

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b last:border-b-0">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900 text-right break-words">
        {value ?? "-"}
      </div>
    </div>
  );
}

export default function StudentProfileCard({ student }) {
  if (!student) return null;

  const dob = student?.dateOfBirth
    ? new Date(student.dateOfBirth).toLocaleDateString()
    : "-";

  const admissionDate = student?.admissionDate
    ? new Date(student.admissionDate).toLocaleDateString()
    : "-";

  return (
    <div className="w-full bg-white rounded-xl shadow-md border p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {student.firstName && student.lastName 
              ? `${student.firstName} ${student.lastName}` 
              : "Inmate"}
          </h2>
          <p className="text-sm text-gray-500">
            Inmate ID: {student.inmateId}
          </p>
        </div>
      </div>

      {/* Quick info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500">Status</p>
          <p className="font-semibold text-gray-800">
            {student?.status ?? "-"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Custody Type: {student?.custodyType ?? "-"}
          </p>
        </div>

        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500">Account</p>
          <p className="font-semibold text-gray-800">
            Balance: ${student?.balance ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Blocked: {student?.is_blocked === "true" ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="border rounded-lg px-4">
        <Row label="Phone Number" value={student.phonenumber} />
        <Row label="Cell Number" value={student.cellNumber || "N/A"} />
        <Row label="Date of Birth" value={dob} />
        <Row label="Admission Date" value={admissionDate} />
        <Row label="Location ID" value={student.location_id} />
      </div>
    </div>
  );
}
