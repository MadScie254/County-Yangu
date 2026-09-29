import { Plus, Edit, Trash2, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AdminActionModal } from "@/components/AdminActionModal";
import { addService, removeService, updateService, useServices } from "@/lib/store";
import { useToast } from "@/context/ToastContext";

type ModalMode = "add" | "edit" | "delete" | null;

export default function AdminServices() {
  const { data: services, loading } = useServices();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    department: "General Administration",
    fee: "Variable",
  });

  const selectedService = services.find((service) => service.id === selectedServiceId);
  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.department.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const openAddModal = () => {
    setForm({ name: "", department: "General Administration", fee: "Variable" });
    setModalMode("add");
  };

  const openEditModal = (serviceId: number) => {
    const service = services.find((entry) => entry.id === serviceId);
    if (!service) return;

    setSelectedServiceId(serviceId);
    setForm({ name: service.name, department: service.department, fee: service.fee });
    setModalMode("edit");
  };

  const openDeleteModal = (serviceId: number) => {
    setSelectedServiceId(serviceId);
    setModalMode("delete");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedServiceId(null);
    setIsSaving(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast({ type: "warning", title: "Missing name", message: "Enter a service name to continue." });
      return;
    }

    setIsSaving(true);

    try {
      if (modalMode === "add") {
        await addService({ ...form, status: "Draft" });
        showToast({ type: "success", title: "Service added", message: `${form.name} was created as a draft.` });
      }

      if (modalMode === "edit" && selectedServiceId) {
        await updateService(selectedServiceId, form);
        showToast({ type: "success", title: "Service updated", message: `${form.name} has been saved.` });
      }

      if (modalMode === "delete" && selectedServiceId && selectedService) {
        await removeService(selectedServiceId);
        showToast({ type: "success", title: "Service removed", message: `${selectedService.name} was deleted.` });
      }

      closeModal();
    } catch (error) {
      console.error(error);
      showToast({ type: "error", title: "Action failed", message: "Could not save service changes." });
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Services Management</h2>
            <p className="text-gray-500">Manage the services offered to citizens.</p>
          </div>
          <button type="button" onClick={openAddModal} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Add Service
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading services...</div>
          ) : filteredServices.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {services.length === 0 ? "No services yet. Add your first county service." : "No services match your search."}
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Fee Type</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{service.name}</td>
                    <td className="px-6 py-4 text-gray-600">{service.department}</td>
                    <td className="px-6 py-4 text-gray-600">{service.fee}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                        {service.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button type="button" onClick={() => openEditModal(service.id)} className="p-2 text-gray-400 hover:text-emerald-600" aria-label={`Edit ${service.name}`}>
                        <Edit className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => openDeleteModal(service.id)} className="p-2 text-gray-400 hover:text-red-600" aria-label={`Delete ${service.name}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AdminActionModal
        isOpen={modalMode === "add" || modalMode === "edit"}
        onClose={closeModal}
        title={modalMode === "add" ? "Add Service" : "Edit Service"}
        description="Define the service citizens will see in the catalog."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service name</label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="County Service"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              value={form.department}
              onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fee label</label>
            <input
              value={form.fee}
              onChange={(event) => setForm((current) => ({ ...current, fee: event.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Service
            </button>
          </div>
        </div>
      </AdminActionModal>

      <AdminActionModal
        isOpen={modalMode === "delete"}
        onClose={closeModal}
        title="Remove Service"
        description={`Are you sure you want to remove ${selectedService?.name ?? "this service"}?`}
      >
        <div className="flex justify-end gap-3">
          <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete Service
          </button>
        </div>
      </AdminActionModal>
    </DashboardLayout>
  );
}
