import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, ShoppingCart, ShoppingBag, TrendingUp, Download, AlertCircle, CheckCircle, AlertTriangle, Package } from 'lucide-react';

const Dashboard = () => {
  const [token, setToken] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('today');
  const [sortBy, setSortBy] = useState('ventas');
  const [filterMovement, setFilterMovement] = useState('todos');

  // Datos mock - En producción vendrían de Supabase
  const mockData = {
    resumen: {
      ventas: 65000,
      compras: 34000,
      consumos: 3000,
      utilidad: 28000
    },
    ventasSemanales: [
      { dia: 'Lun', ventas: 8500, compras: 4500, gastos: 400 },
      { dia: 'Mar', ventas: 9200, compras: 5200, gastos: 500 },
      { dia: 'Mié', ventas: 10100, compras: 4800, gastos: 450 },
      { dia: 'Jue', ventas: 11500, compras: 6100, gastos: 550 },
      { dia: 'Vie', ventas: 12300, compras: 6800, gastos: 600 },
      { dia: 'Sáb', ventas: 7400, compras: 3600, gastos: 300 },
      { dia: 'Dom', ventas: 6000, compras: 3000, gastos: 200 }
    ],
    topProductos: [
      { codigo: 'P001', nombre: 'Coca Cola 350ml', vendidos: 145, total: 217500, stock: 15, margen: 35 },
      { codigo: 'P002', nombre: 'Pan Tajado', vendidos: 98, total: 147000, stock: 45, margen: 28 },
      { codigo: 'P003', nombre: 'Leche Entera 1L', vendidos: 87, total: 130500, stock: 8, margen: 22 },
      { codigo: 'P004', nombre: 'Arroz x 500g', vendidos: 76, total: 114000, stock: 120, margen: 18 },
      { codigo: 'P005', nombre: 'Huevos x 30und', vendidos: 65, total: 97500, stock: 2, margen: 25 }
    ],
    productosChart: [
      { nombre: 'Coca Cola', valor: 217500, porcentaje: 30 },
      { nombre: 'Pan Tajado', valor: 147000, porcentaje: 20 },
      { nombre: 'Leche', valor: 130500, porcentaje: 18 },
      { nombre: 'Arroz', valor: 114000, porcentaje: 16 },
      { nombre: 'Otros', valor: 116000, porcentaje: 16 }
    ],
    tendencia: [
      { dia: 'Lun', acumulado: 8500 },
      { dia: 'Mar', acumulado: 17700 },
      { dia: 'Mié', acumulado: 27800 },
      { dia: 'Jue', acumulado: 39300 },
      { dia: 'Vie', acumulado: 51600 },
      { dia: 'Sáb', acumulado: 59000 },
      { dia: 'Dom', acumulado: 65000 }
    ],
    movimientos: [
      { tipo: 'Venta', producto: 'Coca Cola 350ml', cantidad: 12, valor: 18000, fecha: '29/10/2025 14:30' },
      { tipo: 'Compra', producto: 'Pan Tajado', cantidad: 50, valor: 62500, fecha: '29/10/2025 13:15' },
      { tipo: 'Venta', producto: 'Leche Entera 1L', cantidad: 8, valor: 12000, fecha: '29/10/2025 12:45' },
      { tipo: 'Consumo', producto: 'Café x 500g', cantidad: 2, valor: 3000, fecha: '29/10/2025 11:20' },
      { tipo: 'Venta', producto: 'Arroz x 500g', cantidad: 15, valor: 22500, fecha: '29/10/2025 10:30' }
    ],
    alertas: {
      stockBajo: ['Coca Cola 350ml (15 und)', 'Leche Entera 1L (8 und)', 'Huevos x 30und (2 und)'],
      sinMovimiento: ['Atún enlatado', 'Galletas María'],
      masRentable: 'Coca Cola 350ml (35% margen)'
    },
    kpis: {
      ticketPromedio: 4333,
      mayorRotacion: 'Coca Cola 350ml',
      masRentable: 'Coca Cola 350ml',
      variacion: 12.5
    }
  };

  useEffect(() => {
    // Extraer token de la URL
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    
    // Simular validación de token
    setTimeout(() => {
      if (urlToken && urlToken.length > 10) {
        setToken(urlToken);
        setIsValidToken(true);
      } else {
        setIsValidToken(false);
      }
      setLoading(false);
    }, 1500);
  }, []);

  const handleExportPDF = () => {
    alert('Función de exportar PDF - Implementar con jsPDF o html2pdf');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">El enlace es inválido o ha expirado. Por favor, solicita un nuevo enlace de acceso.</p>
        </div>
      </div>
    );
  }

  const sortedProducts = [...mockData.topProductos].sort((a, b) => {
    if (sortBy === 'ventas') return b.vendidos - a.vendidos;
    if (sortBy === 'stock') return a.stock - b.stock;
    if (sortBy === 'margen') return b.margen - a.margen;
    return 0;
  });

  const filteredMovements = filterMovement === 'todos' 
    ? mockData.movimientos 
    : mockData.movimientos.filter(m => m.tipo.toLowerCase() === filterMovement.toLowerCase());

  return (
    <div className="min-h-screen bg-gray-50">
      <div id="dashboard-content" className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-emerald-600 flex items-center gap-2">
                <ShoppingBag className="w-8 h-8" />
                PosWhatsApp
              </h1>
              <p className="text-gray-600 mt-1">Informe del 29 de Octubre, 2025</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <select 
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="today">Hoy</option>
                <option value="week">Esta Semana</option>
                <option value="month">Este Mes</option>
                <option value="custom">Personalizado</option>
              </select>
              
              <button 
                onClick={handleExportPDF}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 justify-center transition-colors"
              >
                <Download className="w-5 h-5" />
                Exportar PDF
              </button>
            </div>
          </div>
        </div>

        {/* Resumen Ejecutivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-emerald-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Ventas</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(mockData.resumen.ventas)}</p>
              </div>
              <div className="bg-emerald-100 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Compras</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(mockData.resumen.compras)}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Consumos</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(mockData.resumen.consumos)}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-full">
                <Package className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Utilidad Bruta</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(mockData.resumen.utilidad)}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Ventas vs Compras vs Gastos (Última Semana)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockData.ventasSemanales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="ventas" fill="#10b981" name="Ventas" />
                <Bar dataKey="compras" fill="#3b82f6" name="Compras" />
                <Bar dataKey="gastos" fill="#f59e0b" name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Top 5 Productos Más Vendidos</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={mockData.productosChart}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ nombre, porcentaje }) => `${nombre} ${porcentaje}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="valor"
                >
                  {mockData.productosChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Línea de Tendencia */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Ventas Acumuladas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={mockData.tendencia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="acumulado" stroke="#10b981" strokeWidth={3} name="Ventas Acumuladas" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla Top Productos */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h3 className="text-lg font-bold text-gray-800">Top Productos</h3>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="ventas">Ordenar por Ventas</option>
              <option value="stock">Ordenar por Stock</option>
              <option value="margen">Ordenar por Margen</option>
            </select>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendidos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margen</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedProducts.map((producto, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{producto.codigo}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{producto.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{producto.vendidos}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(producto.total)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        producto.stock < 10 ? 'bg-red-100 text-red-800' : 
                        producto.stock < 50 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-green-100 text-green-800'
                      }`}>
                        {producto.stock} und
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        producto.margen > 30 ? 'bg-green-100 text-green-800' : 
                        producto.margen > 20 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {producto.margen}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Últimos Movimientos */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h3 className="text-lg font-bold text-gray-800">Últimos Movimientos</h3>
            <select 
              value={filterMovement}
              onChange={(e) => setFilterMovement(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="todos">Todos los movimientos</option>
              <option value="venta">Solo Ventas</option>
              <option value="compra">Solo Compras</option>
              <option value="consumo">Solo Consumos</option>
            </select>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha/Hora</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMovements.map((mov, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        mov.tipo === 'Venta' ? 'bg-emerald-100 text-emerald-800' : 
                        mov.tipo === 'Compra' ? 'bg-blue-100 text-blue-800' : 
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {mov.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{mov.producto}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{mov.cantidad}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(mov.valor)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{mov.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alertas y Recomendaciones */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h4 className="font-bold text-gray-800">Stock Bajo</h4>
            </div>
            <ul className="space-y-2">
              {mockData.alertas.stockBajo.map((item, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              <h4 className="font-bold text-gray-800">Sin Movimiento</h4>
            </div>
            <ul className="space-y-2">
              {mockData.alertas.sinMovimiento.map((item, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-yellow-500 mt-1">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <h4 className="font-bold text-gray-800">Más Rentable</h4>
            </div>
            <p className="text-sm text-gray-700 mb-3">{mockData.alertas.masRentable}</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-green-800 mb-1">💡 Sugerencia:</p>
              <p className="text-sm text-green-700">Reponer Coca Cola 350ml (quedan 15 und)</p>
            </div>
          </div>
        </div>

        {/* Indicadores Clave */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Indicadores Clave de Rendimiento</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4">
              <p className="text-sm text-emerald-700 font-medium mb-1">Ticket Promedio</p>
              <p className="text-2xl font-bold text-emerald-900">{formatCurrency(mockData.kpis.ticketPromedio)}</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-700 font-medium mb-1">Mayor Rotación</p>
              <p className="text-lg font-bold text-blue-900">{mockData.kpis.mayorRotacion}</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
              <p className="text-sm text-purple-700 font-medium mb-1">Más Rentable</p>
              <p className="text-lg font-bold text-purple-900">{mockData.kpis.masRentable}</p>
            </div>
            
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4">
              <p className="text-sm text-amber-700 font-medium mb-1">Variación vs Ayer</p>
              <p className="text-2xl font-bold text-amber-900 flex items-center gap-1">
                <TrendingUp className="w-5 h-5" />
                +{mockData.kpis.variacion}%
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Dashboard generado automáticamente • PosWhatsApp © 2025</p>
          <p className="mt-1 text-xs">Token: {token.substring(0, 10)}...</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;