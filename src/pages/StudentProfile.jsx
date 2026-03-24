import StudentProfileCard from "../components/student/StudentProfileCard";
import { useAuth } from "../context/AuthContext";
import { useStudentProfile } from "../hooks/useStudentExactQuery";

export default function StudentProfilePage() {
  const { user } = useAuth();
  const { data, isLoading } = useStudentProfile(user?.username);

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <StudentProfileCard student={data?.data?.[0]} />
    </div>
  );
}
