import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { CRITERIA } from "../components/assessments/AssessmentConfig";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Assessment, Pitch, User } from "../types";

const recommendationBadge: Record<string, string> = {
  proceed: "bg-green-100 text-green-700",
  park: "bg-amber-100 text-amber-700",
  decline: "bg-red-100 text-red-700",
};

export default function AssessmentsPage(): React.JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const canCreate: boolean =
    user?.role === "admin" || user?.role === "assessor";

  useEffect((): void => {
    Promise.all([
      api.get<Assessment[]>("/assessments"),
      api.get<Pitch[]>("/pitches"),
      api.get<User[]>("/users/directory"),
    ])
      .then(([aRes, pRes, uRes]): void => {
        setAssessments(aRes.data);
        setPitches(pRes.data);
        setUsers(uRes.data);
        setLoading(false);
      })
      .catch((): void => {
        setLoading(false);
      });
  }, []);

  function getPitchTitle(pitchId: string): string {
    const p = pitches.find((p: Pitch): boolean => p.id === pitchId);
    return p ? p.title : "Unknown";
  }

  function getAssessorName(assessorId: string): string {
    const u = users.find((u: User): boolean => u.id === assessorId);
    return u ? u.display_name : "Unknown";
  }

  function getAvgScore(assessment: Assessment): string {
    const total = CRITERIA.reduce(
      (sum: number, criterion) =>
        sum + ((assessment[criterion.key as keyof Assessment] as number) || 0),
      0,
    );
    return (total / CRITERIA.length).toFixed(1);
  }

  return (
    <Layout>
      <PageHeader
        title="Assessments"
        description={`${String(assessments.length)} assessment${assessments.length !== 1 ? "s" : ""} recorded`}
        action={
          canCreate && (
            <Link
              to="/assessments/new"
              className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
            >
              New Assessment
            </Link>
          )
        }
      />

      {loading ? (
        <p className="text-navy-400">Loading...</p>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-navy-100 p-8 text-center">
          <p className="text-navy-500 mb-3">No assessments yet.</p>
          {canCreate && (
            <Link
              to="/assessments/new"
              className="text-sm text-navy-600 underline hover:text-navy-900"
            >
              Create your first assessment
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 border-b border-navy-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Pitch
                </th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Assessor
                </th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Date
                </th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Avg Score
                </th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Recommendation
                </th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Version
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {assessments.map((assessment: Assessment) => (
                <tr
                  key={assessment.id}
                  onClick={() => {
                    void navigate(`/assessments/${assessment.id}`);
                  }}
                  className="hover:bg-navy-50/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-navy-900">
                    {getPitchTitle(assessment.pitch_id)}
                  </td>
                  <td className="px-4 py-3 text-navy-500">
                    {getAssessorName(assessment.assessor_id)}
                  </td>
                  <td className="px-4 py-3 text-navy-500">
                    {assessment.assessment_date}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-navy-900">
                      {getAvgScore(assessment)}
                    </span>
                    <span className="text-navy-400">/5</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-1 rounded-full capitalize ${recommendationBadge[assessment.recommendation] || "bg-gray-100"}`}
                    >
                      {assessment.recommendation}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-500">
                    v{assessment.version}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
