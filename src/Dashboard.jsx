import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, ShoppingCart, ShoppingBag, TrendingUp, Download, AlertCircle, CheckCircle, AlertTriangle, Package, X, FileText } from 'lucide-react';
import { supabase } from './supabaseClient';

const Dashboard = () => {
  const [token, setToken] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState(null);
  const [dateRange, setDateRange] = useState('today');
  const [sortBy, setSortBy] = useState('ventas');
  const [filterMovement, setFilterMovement] = useState('todos');
  const [dashboardData, setDashboardData] = useState(null);
  const [customDates, setCustomDates] = useState(null);
  
  // Estados para el modal de cierre
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [cierreStep, setCierreStep] = useState(1); // 1 = ingreso, 2 = confirmación
  const [cajaContada, setCajaContada] = useState('');
  const [notasCierre, setNotasCierre] = useState('');
  const [cierreData, setCierreData] = useState(null);
  const [savingCierre, setSavingCierre] = useState(false);

  useEffect(() => {
    const initDashboard = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      
      if (!urlToken) {
        setIsValidToken(false);
        setLoading(false);
        return;
      }

      setToken(urlToken);

      const { data: tokenData, error } = await supabase
        .from('form_tokens')
        .select('tenant_id, user_id, expires_at, usos')
        .eq('token', urlToken)
        .eq('tipo_form', 'informe_dashboard')
        .single();

      if (error || !tokenData) {
        setIsValidToken(false);
        setLoading(false);
        return;
      }

      const now = new Date();
      const expiresAt = new Date(tokenData.expires_at);
      
      if (now > expiresAt || tokenData.usos >= 1) {
        setIsValidToken(false);
        setLoading(false);
        return;
      }

      await supabase
        .from('form_tokens')
        .update({ 
          usos: tokenData.usos + 1,
          ultimo_uso_at: new Date().toISOString()
        })
        .eq('token', urlToken);

      setIsValidToken(true);
      setTenantId(tokenData.tenant_id);
      await loadDashboardData(tokenData.tenant_id);
    };

    initDashboard();
  }, []);

  const loadDashboardData = async (tenant_id, fechaInicioToken = null, fechaFinToken = null) => {
    try {
      let startDate, endDate;
      
      if (fechaInicioToken && fechaFinToken) {
        startDate = `${fechaInicioToken} 00:00:00`;
        endDate = `${fechaFinToken} 23:59:59`;
      } else {
        const dateRangeResult = getDateRange(dateRange);
        startDate = dateRangeResult.startDate;
        endDate = dateRangeResult.endDate;
      }

      const { data: ventas, error: ventasError } = await supabase
        .from('ventas')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('activo', true)
        .is('deleted_at', null);

      if (ventasError) throw ventasError;

      const { data: compras, error: comprasError } = await supabase
        .from('movimientos_inventario')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('tipo', 'entrada')
        .eq('activo', true)
        .is('deleted_at', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (comprasError) throw comprasError;

      const { data: consumos, error: consumosError } = await supabase
        .from('movimientos_inventario')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('tipo', 'consumo_personal')
        .eq('activo', true)
        .is('deleted_at', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (consumosError) throw consumosError;

      const { data: gastos, error: gastosError } = await supabase
        .from('gastos')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('activo', true)
        .is('deleted_at', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (gastosError) throw gastosError;

      const { data: productos, error: productosError } = await supabase
        .from('productos')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('activo', true)
        .is('deleted_at', null);

      if (productosError) throw productosError;

      const processedData = processDashboardData(ventas, compras, consumos, gastos, productos);
      setDashboardData(processedData);
      setLoading(false);

    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };

  const getDateRange = (range) => {
    const now = new Date();
    let fechaInicio, fechaFin;
  
    switch (range) {
      case 'today':
        fechaInicio = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        fechaFin = new Date(now.setHours(23, 59, 59, 999)).toISOString();
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        fechaInicio = weekStart.toISOString();
        fechaFin = new Date().toISOString();
        break;
      case 'month':
        const monthStart = new Date(now);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        fechaInicio = monthStart.toISOString();
        fechaFin = new Date().toISOString();
        break;
      default:
        fechaInicio = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        fechaFin = new Date(now.setHours(23, 59, 59, 999)).toISOString();
    }
  
    return { startDate: fechaInicio, endDate: fechaFin };
  };

  const processDashboardData = (ventas, compras, consumos, gastos, productos) => {
    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    const totalCompras = compras.reduce((sum, c) => sum + parseFloat(c.costo_total || 0), 0);
    const totalConsumos = consumos.reduce((sum, c) => sum + parseFloat(c.costo_total || 0), 0);
    const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
    const utilidadBruta = totalVentas - totalCompras - totalConsumos;

    const productosVendidos = {};
    ventas.forEach(venta => {
      if (venta.items && Array.isArray(venta.items)) {
        venta.items.forEach(item => {
          const productoNombre = item.PRODUCTO || item.producto;
          if (!productosVendidos[productoNombre]) {
            productosVendidos[productoNombre] = {
              nombre: productoNombre,
              cantidad: 0,
              total: 0,
              costo: parseFloat(item.COSTO || 0)
            };
          }
          productosVendidos[productoNombre].cantidad += parseFloat(item.CANTIDAD || 0);
          productosVendidos[productoNombre].total += parseFloat(item.VALOR_TOTAL || 0);
        });
      }
    });

    const topProductos = Object.values(productosVendidos)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((prod, index) => {
        const productoInfo = productos.find(p => p.producto === prod.nombre);
        return {
          codigo: productoInfo?.codigo || `P${String(index + 1).padStart(3, '0')}`,
          nombre: prod.nombre,
          vendidos: Math.round(prod.cantidad),
          total: prod.total,
          stock: parseFloat(productoInfo?.stock_actual || 0),
          margen: productoInfo?.precio_venta && prod.costo ? 
            Math.round(((productoInfo.precio_venta - prod.costo) / productoInfo.precio_venta) * 100) : 0
        };
      });

    const productosChart = topProductos.map(p => ({
      nombre: p.nombre.length > 15 ? p.nombre.substring(0, 15) + '...' : p.nombre,
      valor: p.total,
      porcentaje: Math.round((p.total / totalVentas) * 100)
    }));

    const stockBajo = productos
      .filter(p => parseFloat(p.stock_actual) < 10)
      .slice(0, 5)
      .map(p => `${p.producto} (${Math.round(p.stock_actual)} und)`);

    const productosSinMovimiento = productos
      .filter(p => !productosVendidos[p.producto])
      .slice(0, 5)
      .map(p => p.producto);

    const masRentable = topProductos.length > 0 ? 
      topProductos.reduce((max, p) => p.margen > max.margen ? p : max, topProductos[0]) : null;

    const ventasPorDia = getVentasPorDia(ventas, compras, gastos);
    const tendencia = getTendenciaAcumulada(ventas);
    const ultimosMovimientos = getUltimosMovimientos(ventas, compras, consumos, productos);

    const ticketPromedio = ventas.length > 0 ? totalVentas / ventas.length : 0;
    const productoMayorRotacion = topProductos.length > 0 ? topProductos[0].nombre : 'N/A';

    return {
      resumen: {
        ventas: totalVentas,
        compras: totalCompras,
        consumos: totalConsumos + totalGastos,
        utilidad: utilidadBruta
      },
      ventasSemanales: ventasPorDia,
      topProductos: topProductos,
      productosChart: productosChart,
      tendencia: tendencia,
      movimientos: ultimosMovimientos,
      alertas: {
        stockBajo: stockBajo,
        sinMovimiento: productosSinMovimiento,
        masRentable: masRentable ? `${masRentable.nombre} (${masRentable.margen}% margen)` : 'N/A'
      },
      kpis: {
        ticketPromedio: ticketPromedio,
        mayorRotacion: productoMayorRotacion,
        masRentable: masRentable ? masRentable.nombre : 'N/A',
        variacion: 0
      }
    };
  };

  const getVentasPorDia = (ventas, compras, gastos) => {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const ventasPorDia = {};

    for (let i = 6; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      const dia = dias[fecha.getDay()];
      ventasPorDia[dia] = { dia, ventas: 0, compras: 0, gastos: 0 };
    }

    ventas.forEach(v => {
      const fecha = new Date(v.created_at);
      const dia = dias[fecha.getDay()];
      if (ventasPorDia[dia]) {
        ventasPorDia[dia].ventas += parseFloat(v.total || 0);
      }
    });

    compras.forEach(c => {
      const fecha = new Date(c.created_at);
      const dia = dias[fecha.getDay()];
      if (ventasPorDia[dia]) {
        ventasPorDia[dia].compras += parseFloat(c.costo_total || 0);
      }
    });

    gastos.forEach(g => {
      const fecha = new Date(g.created_at);
      const dia = dias[fecha.getDay()];
      if (ventasPorDia[dia]) {
        ventasPorDia[dia].gastos += parseFloat(g.monto || 0);
      }
    });

    return Object.values(ventasPorDia);
  };

  const getTendenciaAcumulada = (ventas) => {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const ventasPorDia = {};
    let acumulado = 0;

    for (let i = 6; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      const dia = dias[fecha.getDay()];
      ventasPorDia[dia] = 0;
    }

    ventas.forEach(v => {
      const fecha = new Date(v.created_at);
      const dia = dias[fecha.getDay()];
      if (ventasPorDia.hasOwnProperty(dia)) {
        ventasPorDia[dia] += parseFloat(v.total || 0);
      }
    });

    return Object.entries(ventasPorDia).map(([dia, monto]) => {
      acumulado += monto;
      return { dia, acumulado: Math.round(acumulado) };
    });
  };

  const getUltimosMovimientos = (ventas, compras, consumos, productos) => {
    const movimientos = [];

    ventas.slice(0, 10).forEach(v => {
      if (v.items && v.items.length > 0) {
        const item = v.items[0];
        movimientos.push({
          tipo: 'Venta',
          producto: item.PRODUCTO || item.producto || 'Producto desconocido',
          cantidad: parseFloat(item.CANTIDAD || 0),
          valor: parseFloat(v.total || 0),
          fecha: new Date(v.created_at).toLocaleString('es-CO')
        });
      }
    });

    compras.slice(0, 5).forEach(c => {
      const producto = productos.find(p => p.producto_id === c.producto_id);
      movimientos.push({
        tipo: 'Compra',
        producto: producto?.producto || 'Producto desconocido',
        cantidad: parseFloat(c.cantidad || 0),
        valor: parseFloat(c.costo_total || 0),
        fecha: new Date(c.created_at).toLocaleString('es-CO')
      });
    });

    consumos.slice(0, 5).forEach(c => {
      const producto = productos.find(p => p.producto_id === c.producto_id);
      movimientos.push({
        tipo: 'Consumo',
        producto: producto?.producto || 'Producto desconocido',
        cantidad: parseFloat(c.cantidad || 0),
        valor: parseFloat(c.costo_total || 0),
        fecha: new Date(c.created_at).toLocaleString('es-CO')
      });
    });

    return movimientos
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 10);
  };

  // FUNCIONES DE CIERRE
  const handleAbrirCierre = async () => {
    // Verificar si ya existe un cierre para este período
    const { startDate, endDate } = getDateRange(dateRange);
    
    const { data: cierreExistente } = await supabase
      .from('cierres')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('periodo_inicio', startDate)
      .eq('periodo_fin', endDate)
      .single();

    if (cierreExistente) {
      alert('Ya existe un cierre para este período. Seleccione otro rango de fechas.');
      return;
    }

    // Calcular datos del cierre
    const cajaEsperada = dashboardData.resumen.ventas - dashboardData.resumen.compras - (dashboardData.resumen.consumos);
    
    // Inventario esperado (suma de todos los productos)
    const inventarioEsperado = dashboardData.topProductos.reduce((sum, p) => sum + p.stock, 0);

    setCierreData({
      cajaEsperada,
      inventarioEsperado,
      ventasTotal: dashboardData.resumen.ventas,
      comprasTotal: dashboardData.resumen.compras,
      consumosTotal: dashboardData.resumen.consumos,
      utilidadNeta: dashboardData.resumen.utilidad
    });

    setShowCierreModal(true);
    setCierreStep(1);
    setCajaContada('');
    setNotasCierre('');
  };

  const handleProcesarCierre = () => {
    if (!cajaContada || parseFloat(cajaContada) < 0) {
      alert('Por favor ingrese el dinero en caja');
      return;
    }

    setCierreStep(2);
  };

  const handleGuardarCierre = async () => {
    setSavingCierre(true);
    
    try {
      const { startDate, endDate } = getDateRange(dateRange);
      const cajaReal = parseFloat(cajaContada);
      const diferenciaCaja = cierreData.cajaEsperada - cajaReal;
      const cuadrado = Math.abs(diferenciaCaja) < 100; // Tolerancia de $100

      const cierreRecord = {
        tenant_id: tenantId,
        periodo_inicio: startDate,
        periodo_fin: endDate,
        tipo_cierre: dateRange,
        ventas_total: cierreData.ventasTotal,
        compras_total: cierreData.comprasTotal,
        consumo_personal_total: cierreData.consumosTotal,
        gastos_total: 0,
        utilidad_neta: cierreData.utilidadNeta,
        caja_inicial: 0,
        caja_esperada: cierreData.cajaEsperada,
        caja_real: cajaReal,
        diferencia_caja: diferenciaCaja,
        inventario_esperado: cierreData.inventarioEsperado,
        inventario_real: cierreData.inventarioEsperado, // Por ahora usamos el esperado
        diferencia_inventario: 0,
        cuadrado: cuadrado,
        notas: notasCierre,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('cierres')
        .insert([cierreRecord])
        .select();

      if (error) throw error;

      alert('✅ Cierre guardado exitosamente');
      setShowCierreModal(false);
      
    } catch (error) {
      console.error('Error guardando cierre:', error);
      alert('Error al guardar el cierre: ' + error.message);
    } finally {
      setSavingCierre(false);
    }
  };

  const handleDescargarPDF = () => {
    alert('Función de descarga de PDF del cierre - Implementar con jsPDF');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatDateRange = () => {
    const { startDate, endDate } = getDateRange(dateRange);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const options = { day: '2-digit', month: 'short' };
    return `${start.toLocaleDateString('es-CO', options).toUpperCase()} - ${end.toLocaleDateString('es-CO', options).toUpperCase()} ${end.getFullYear()}`;
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  useEffect(() => {
    if (tenantId && !customDates) {
      setLoading(true);
      loadDashboardData(tenantId);
    }
  }, [dateRange]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg font-medium">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 mb-4">
            El token proporcionado no es válido o ha expirado.
          </p>
          <p className="text-sm text-gray-500">
            Por favor, solicite un nuevo enlace de acceso.
          </p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
        <p className="text-gray-600">No hay datos disponibles</p>
      </div>
    );
  }

  const sortedProducts = [...dashboardData.topProductos].sort((a, b) => {
    if (sortBy === 'ventas') return b.total - a.total;
    if (sortBy === 'stock') return b.stock - a.stock;
    if (sortBy === 'margen') return b.margen - a.margen;
    return 0;
  });

  const filteredMovements = dashboardData.movimientos.filter(mov => {
    if (filterMovement === 'todos') return true;
    return mov.tipo.toLowerCase() === filterMovement.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard POS</h1>
              <p className="text-gray-600">Análisis de ventas, compras y rendimiento</p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <select 
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="today">Hoy</option>
                <option value="week">Última Semana</option>
                <option value="month">Este Mes</option>
              </select>
              
              <button 
                onClick={handleAbrirCierre}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 font-medium"
              >
                <CheckCircle className="w-5 h-5" />
                Hacer Cierre
              </button>
              
              <button 
                onClick={() => alert('Exportar PDF - Implementar con jsPDF')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 font-medium"
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
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.ventas)}</p>
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
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.compras)}</p>
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
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.consumos)}</p>
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
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.utilidad)}</p>
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
              <BarChart data={dashboardData.ventasSemanales}>
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
            {dashboardData.productosChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dashboardData.productosChart}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ nombre, porcentaje }) => `${nombre} ${porcentaje}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="valor"
                  >
                    {dashboardData.productosChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No hay datos de productos para mostrar
              </div>
            )}
          </div>
        </div>

        {/* Modal de Cierre */}
        {showCierreModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header del Modal */}
              <div className="bg-emerald-600 text-white p-6 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Cierre del Período</h2>
                    <p className="text-emerald-100 mt-1">{formatDateRange()}</p>
                  </div>
                  <button 
                    onClick={() => setShowCierreModal(false)}
                    className="text-white hover:bg-emerald-700 p-2 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Contenido del Modal */}
              <div className="p-6">
                {cierreStep === 1 ? (
                  // PASO 1: Ingreso de Datos
                  <div className="space-y-6">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Valores Esperados (Sistema)
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <p className="text-sm text-gray-600 mb-1">💰 Caja Esperada</p>
                          <p className="text-2xl font-bold text-emerald-700">
                            {formatCurrency(cierreData.cajaEsperada)}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            = Ventas ({formatCurrency(cierreData.ventasTotal)}) - Compras ({formatCurrency(cierreData.comprasTotal)}) - Gastos ({formatCurrency(cierreData.consumosTotal)})
                          </p>
                        </div>

                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <p className="text-sm text-gray-600 mb-1">📦 Inventario Esperado</p>
                          <p className="text-2xl font-bold text-emerald-700">
                            {Math.round(cierreData.inventarioEsperado)} und
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            Suma de stock de todos los productos
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          💵 Dinero en Caja (Conteo Manual) *
                        </label>
                        <input
                          type="number"
                          value={cajaContada}
                          onChange={(e) => setCajaContada(e.target.value)}
                          placeholder="Ingrese el dinero contado en caja"
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          📝 Notas / Observaciones (Opcional)
                        </label>
                        <textarea
                          value={notasCierre}
                          onChange={(e) => setNotasCierre(e.target.value)}
                          placeholder="Ej: Diferencia por vueltos, gastos no registrados, etc."
                          rows={3}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setShowCierreModal(false)}
                        className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleProcesarCierre}
                        disabled={!cajaContada || parseFloat(cajaContada) < 0}
                        className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        PROCESAR CIERRE →
                      </button>
                    </div>
                  </div>
                ) : (
                  // PASO 2: Confirmación y Resultados
                  <div className="space-y-6">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
                        Comparativa: Sistema vs Conteo
                      </h3>

                      <div className="grid grid-cols-2 gap-6">
                        {/* COLUMNA IZQUIERDA: SISTEMA */}
                        <div>
                          <h4 className="text-center font-bold text-gray-700 mb-4 text-lg">
                            💻 SISTEMA
                          </h4>
                          <div className="space-y-3">
                            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                              <p className="text-sm text-gray-600 mb-1">Caja Esperada</p>
                              <p className="text-xl font-bold text-gray-900">
                                {formatCurrency(cierreData.cajaEsperada)}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                              <p className="text-sm text-gray-600 mb-1">Inventario Esperado</p>
                              <p className="text-xl font-bold text-gray-900">
                                {Math.round(cierreData.inventarioEsperado)} und
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* COLUMNA DERECHA: CONTEO */}
                        <div>
                          <h4 className="text-center font-bold text-gray-700 mb-4 text-lg">
                            ✋ CONTEO MANUAL
                          </h4>
                          <div className="space-y-3">
                            <div className={`rounded-lg p-4 border-2 ${
                              Math.abs(cierreData.cajaEsperada - parseFloat(cajaContada)) < 100
                                ? 'bg-green-50 border-green-500'
                                : 'bg-red-50 border-red-500'
                            }`}>
                              <p className="text-sm text-gray-600 mb-1">Caja Contada</p>
                              <p className="text-xl font-bold text-gray-900">
                                {formatCurrency(parseFloat(cajaContada))}
                              </p>
                              {Math.abs(cierreData.cajaEsperada - parseFloat(cajaContada)) >= 100 && (
                                <p className="text-sm font-bold text-red-600 mt-2">
                                  Diferencia: {formatCurrency(Math.abs(cierreData.cajaEsperada - parseFloat(cajaContada)))}
                                </p>
                              )}
                            </div>
                            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-500">
                              <p className="text-sm text-gray-600 mb-1">Inventario Contado</p>
                              <p className="text-xl font-bold text-gray-900">
                                {Math.round(cierreData.inventarioEsperado)} und
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status Final */}
                      <div className={`mt-6 rounded-lg p-4 text-center ${
                        Math.abs(cierreData.cajaEsperada - parseFloat(cajaContada)) < 100
                          ? 'bg-green-100 border-2 border-green-500'
                          : 'bg-red-100 border-2 border-red-500'
                      }`}>
                        {Math.abs(cierreData.cajaEsperada - parseFloat(cajaContada)) < 100 ? (
                          <>
                            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-green-800">✅ CUADRADO</p>
                            <p className="text-sm text-green-700 mt-1">El cierre está dentro del margen de tolerancia</p>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-red-800">⚠️ HAY DIFERENCIAS</p>
                            <p className="text-lg font-bold text-red-700 mt-2">
                              Diferencia en caja: {formatCurrency(Math.abs(cierreData.cajaEsperada - parseFloat(cajaContada)))}
                            </p>
                          </>
                        )}
                      </div>

                      {notasCierre && (
                        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <p className="text-sm font-bold text-yellow-900 mb-1">📝 Notas del Cierre:</p>
                          <p className="text-sm text-yellow-800">{notasCierre}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setCierreStep(1)}
                        className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      >
                        ← Volver
                      </button>
                      <button
                        onClick={handleDescargarPDF}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        <FileText className="w-5 h-5" />
                        Descargar PDF
                      </button>
                      <button
                        onClick={handleGuardarCierre}
                        disabled={savingCierre}
                        className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {savingCierre ? 'Guardando...' : 'GUARDAR CIERRE ✓'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Dashboard generado automáticamente • PosWhatsApp © 2025</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;