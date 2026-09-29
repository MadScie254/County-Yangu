import { addDepartment, useDepartments } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Plus, Users, Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { AdminActionModal } from "@/components/AdminActionModal";
import { useToast } from "@/context/ToastContext";

export default function AdminDepartments() {
  const { data: departments, loading } = useDepartments();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    head: "County Officer",
    staff: "12",
    services: "1",
  });

  const handleAddDepartment = async () => {
    if (!form.name.trim()) {
      showToast({ type: "warning", title: "Missing name", message: "Enter a department name to continue." });
      return;
    }

    setIsSaving(true);

    try {
      await addDepartment({
        name: form.name.trim(),
        head: form.head.trim() || "County Officer",
        staff: Number(form.staff) || 0,
        services: Number(form.services) || 0,
      });

      showToast({
        type: "success",
        title: "Department added",
        message: `${form.name} has been created.`,
      });

      setForm({ name: "", head: "County Officer", staff: "12", services: "1" });
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast({ type: "error", title: "Action failed", message: "Could not create the department." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Departments</h2>
            <p className="text-gray-500">Manage county departments and personnel.</p>
          </div>
          <button type="button" onClick={() => setIsModalOpen(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Add Department
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
            Loading departments...
          </div>
        ) : departments.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">No departments yet</h3>
            <p className="text-gray-500 mt-2">Create your first department to organize county services.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept) => (
              <div key={dept.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                    <p className="text-sm text-gray-500">Head: {dept.head}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    {dept.staff} Staff
                  </div>
                  <div className="text-sm font-medium text-emerald-600">
                    {dept.services} Services
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminActionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Department"
        description="Create a new county department."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department name</label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Department of Health"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department head</label>
            <input
              value={form.head}
              onChange={(event) => setForm((current) => ({ ...current, head: event.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff count</label>
              <input
                type="number"
                min="0"
                value={form.staff}
                onChange={(event) => setForm((current) => ({ ...current, staff: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Services count</label>
              <input
                type="number"
                min="0"
                value={form.services}
                onChange={(event) => setForm((current) => ({ ...current, services: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddDepartment}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Department
            </button>
          </div>
        </div>
      </AdminActionModal>
    </DashboardLayout>
  );
}
