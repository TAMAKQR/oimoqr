import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import api from '../services/api';
import DashboardLayout from '../components/DashboardLayout';

const StaffManagementPage = () => {
  const navigate = useNavigate();
  const { restaurantId } = useParams();
  const { logout } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (restaurantId) {
      loadStaff();
    }
  }, [restaurantId]);

  const loadUserData = async () => {
    try {
      const data = await authService.getMe();
      setUserData(data);
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/restaurants/${restaurantId}/staff`);
      setStaff(response.data);
    } catch (err) {
      console.error('Error loading staff:', err);
      setError('Ошибка при загрузке сотрудников');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.email || !formData.password) {
      setError('Email и пароль обязательны');
      return;
    }

    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    try {
      await api.post(`/restaurants/${restaurantId}/staff`, {
        email: formData.email,
        password: formData.password,
        name: formData.name
      });
      setSuccess('Менеджер создан и добавлен успешно!');
      setFormData({ email: '', password: '', name: '' });
      setShowAddForm(false);
      await loadStaff();
    } catch (err) {
      console.error('Error adding staff:', err);
      setError(err.response?.data?.error || 'Ошибка при добавлении менеджера');
    }
  };

  const handleUpdateRole = async (staffId, newRole) => {
    try {
      setError('');
      await api.put(`/restaurants/${restaurantId}/staff/${staffId}`, {
        role: newRole
      });
      setSuccess('Роль обновлена успешно!');
      await loadStaff();
    } catch (err) {
      console.error('Error updating staff:', err);
      setError(err.response?.data?.error || 'Ошибка при обновлении роли');
    }
  };

  const handleRemoveStaff = async (staffId) => {
    if (!confirm('Вы уверены, что хотите удалить этого сотрудника?')) {
      return;
    }

    try {
      setError('');
      await api.delete(`/restaurants/${restaurantId}/staff/${staffId}`);
      setSuccess('Сотрудник удален успешно!');
      await loadStaff();
    } catch (err) {
      console.error('Error removing staff:', err);
      setError(err.response?.data?.error || 'Ошибка при удалении сотрудника');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'cashier':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DashboardLayout userData={userData} selectedRestaurantId={restaurantId}>
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Управление сотрудниками</h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded">
            {success}
          </div>
        )}

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary mb-6"
        >
          {showAddForm ? 'Отменить' : '+ Создать менеджера'}
        </button>

        {showAddForm && (
          <div className="card p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4">Создать менеджера</h3>
            <p className="text-sm text-gray-600 mb-4">
              Создайте учетную запись для менеджера. Он сможет управлять меню: добавлять/редактировать блюда, изменять цены, ставить блюда на стоп.
            </p>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя менеджера
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Иван Петров"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Необязательно. Если не указано, будет использован email
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email для входа
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="manager@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пароль
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Минимум 6 символов"
                  required
                  minLength="6"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Менеджер будет использовать этот пароль для входа в систему
                </p>
              </div>

              <button type="submit" className="btn-primary w-full">
                Создать менеджера
              </button>
            </form>
          </div>
        )}

        {staff.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-gray-600">Менеджеры не найдены</p>
            <p className="text-sm text-gray-500 mt-2">
              Создайте учетную запись менеджера, чтобы делегировать управление меню
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Имя</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ресторан</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Роль</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Права доступа</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{member.user?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{member.user?.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span className="font-medium">{member.restaurant?.name}</span>
                          <span className="text-xs text-gray-500">{member.restaurant?.subdomain}.oimoqr.com</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800">
                          Менеджер
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        Управление меню, блюдами, ценами
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRemoveStaff(member.id)}
                          className="text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StaffManagementPage;
