import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, ShoppingCart, ShoppingBag, TrendingUp, Download, AlertCircle, CheckCircle, AlertTriangle, Package, Calendar, X, FileText, Edit2, RefreshCw, Menu } from 'lucide-react';
import { supabase } from './supabaseClient';

const Dashboard = () => {
  const [token, setToken] = useState('');
  const [isValidToken, setIsValidToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState(null);
  const [dateRange, setDateRange] = useState('today');
  const [sortBy, setSortBy] = useState('ventas');
  const [filterMovement, setFilterMovement] = useState('todos');
  const [dashboardData, setDashboardData] = useState(null);
  const [customDates, setCustomDates] = useState(null);
  const [allProductos, setAllProductos] = useState([]);
  const [gastosDelPeriodo, setGastosDelPeriodo] = useState([]);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [currentDateRange, setCurrentDateRange] = useState({ start: '', end: '' });

  // Estados para el modal de cierre
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [cierreStep, setCierreStep] = useState(1);
  const [cajaContada, setCajaContada] = useState('');
  const [notasCierre, setNotasCierre] = useState('');
  const [cierreData, setCierreData] = useState(null);
  const [savingCierre, setSavingCierre] = useState(false);
  const [stockContadoPorProducto, setStockContadoPorProducto] = useState({});
  const [modoCierre, setModoCierre] = useState('rapido'); // 'rapido', 'critico', 'completo'
  const [productosParaCierre, setProductosParaCierre] = useState([]);

  // Estados para menú hamburguesa y modales
  const [showBaseModal, setShowBaseModal] = useState(false);
  const [showInventarioModal, setShowInventarioModal] = useState(false);
  const [showApodosModal, setShowApodosModal] = useState(false);
  const [baseActual, setBaseActual] = useState(0);
  const [baseProximoPeriodo, setBaseProximoPeriodo] = useState('');
  const [nuevoInventario, setNuevoInventario] = useState({});
  const [apodosProductos, setApodosProductos] = useState({});
  const [showConceptosModal, setShowConceptosModal] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  // Estado para sistema de tabs
  const [activeTab, setActiveTab] = useState('hoy');
  // Estados para comparativas
  const [datosComparativos, setDatosComparativos] = useState(null);

  // FUNCIONES PARA ZONA HORARIA BOGOTÁ
  const getStartOfDayInBogota = (dateString) => {
    const date = new Date(dateString + 'T00:00:00-05:00');
    return date.toISOString();
  };

  const getEndOfDayInBogota = (dateString) => {
    const date = new Date(dateString + 'T23:59:59-05:00');
    return date.toISOString();
  };

  const getTodayInBogota = () => {
    const now = new Date();
    const bogotaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const year = bogotaTime.getFullYear();
    const month = String(bogotaTime.getMonth() + 1).padStart(2, '0');
    const day = String(bogotaTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateToDisplay = (dateString) => {
    if (dateString && dateString.length === 10) {
      const date = new Date(dateString + 'T12:00:00-05:00');
      return date.toLocaleDateString('es-CO', { 
        timeZone: 'America/Bogota',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
    
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', { 
      timeZone: 'America/Bogota',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

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
      console.log('🔍 Cargando datos para tenant_id:', tenant_id);
      
      let startDateISO, endDateISO, displayStartDate, displayEndDate;
      
      if (fechaInicioToken && fechaFinToken) {
        startDateISO = getStartOfDayInBogota(fechaInicioToken);
        endDateISO = getEndOfDayInBogota(fechaFinToken);
        displayStartDate = fechaInicioToken;
        displayEndDate = fechaFinToken;
      } else {
        const dateRangeResult = getDateRange(dateRange);
        startDateISO = dateRangeResult.startDate;
        endDateISO = dateRangeResult.endDate;
        displayStartDate = dateRangeResult.displayStart;
        displayEndDate = dateRangeResult.displayEnd;
      }

      setCurrentDateRange({ start: displayStartDate, end: displayEndDate });

      // 1. Obtener ventas
      const { data: ventas, error: ventasError } = await supabase
        .from('ventas')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('activo', true)
        .is('deleted_at', null)
        .gte('created_at', startDateISO)
        .lte('created_at', endDateISO);

      if (ventasError) throw ventasError;

      // 2. Obtener compras
      const { data: compras, error: comprasError } = await supabase
        .from('movimientos_inventario')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('tipo', 'entrada')
        .eq('activo', true)
        .is('deleted_at', null)
        .gte('created_at', startDateISO)
        .lte('created_at', endDateISO);

      if (comprasError) throw comprasError;

      // 3. Obtener consumos
      const { data: consumos, error: consumosError } = await supabase
        .from('movimientos_inventario')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('tipo', 'consumo')
        .eq('activo', true)
        .is('deleted_at', null)
        .gte('created_at', startDateISO)
        .lte('created_at', endDateISO);

      if (consumosError) throw consumosError;

      // 4. Obtener gastos
      const { data: gastos, error: gastosError } = await supabase
        .from('gastos')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('activo', true)
        .is('deleted_at', null)
        .gte('created_at', startDateISO)
        .lte('created_at', endDateISO);

      if (gastosError) throw gastosError;

      // Obtener mermas para sumarlas a gastos
      const { data: mermas, error: mermasError } = await supabase
        .from('movimientos_inventario')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('tipo', 'merma')
        .eq('activo', true)
        .is('deleted_at', null)
        .gte('created_at', startDateISO)
        .lte('created_at', endDateISO);

      if (mermasError) throw mermasError;

      // 5. Obtener productos
      const { data: productos, error: productosError } = await supabase
        .from('productos')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('activo', true)
        .is('deleted_at', null);

      if (productosError) throw productosError;

      setAllProductos(productos);
      
      // Combinar gastos regulares con consumos y mermas
const gastosCompletos = [
    ...gastos,
    ...consumos.map(c => ({
      ...c,
      categoria: 'Consumo Personal',
      concepto: productos.find(p => p.producto_id === c.producto_id)?.producto || 'Producto desconocido',
      monto: parseFloat(c.costo_total || 0),
      descripcion: `Cantidad: ${c.cantidad || 0}`,
      esMovimiento: true
    })),
    ...mermas.map(m => ({
      ...m,
      categoria: 'Mermas',
      concepto: productos.find(p => p.producto_id === m.producto_id)?.producto || 'Producto desconocido',
      monto: parseFloat(m.costo_total || 0),
      descripcion: `Cantidad: ${m.cantidad || 0}`,
      esMovimiento: true
    }))
  ];
  
  setGastosDelPeriodo(gastosCompletos);

  const processedData = processDashboardData(ventas, compras, consumos, gastos, productos, mermas);
  setDashboardData(processedData);

  // NUEVO: Cargar datos del período anterior para comparativas
  if (dateRange !== 'custom') {
    const periodoAnterior = getPeriodoAnterior(dateRange);
    
    // Obtener ventas del período anterior
    const { data: ventasAnt } = await supabase
      .from('ventas')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('activo', true)
      .is('deleted_at', null)
      .gte('created_at', periodoAnterior.startDate)
      .lte('created_at', periodoAnterior.endDate);

    // Obtener compras del período anterior
    const { data: comprasAnt } = await supabase
      .from('movimientos_inventario')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('tipo', 'entrada')
      .eq('activo', true)
      .is('deleted_at', null)
      .gte('created_at', periodoAnterior.startDate)
      .lte('created_at', periodoAnterior.endDate);

    // Obtener gastos del período anterior
    const { data: gastosAnt } = await supabase
      .from('gastos')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('activo', true)
      .is('deleted_at', null)
      .gte('created_at', periodoAnterior.startDate)
      .lte('created_at', periodoAnterior.endDate);

    // Calcular totales del período anterior
    const totalVentasAnt = (ventasAnt || []).reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    const totalComprasAnt = (comprasAnt || []).reduce((sum, c) => sum + parseFloat(c.costo_total || 0), 0);
    const totalGastosAnt = (gastosAnt || []).reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
    const utilidadAnt = totalVentasAnt - totalComprasAnt;

    // Calcular variaciones porcentuales
    const variacionVentas = totalVentasAnt > 0 
      ? ((processedData.resumen.ventas - totalVentasAnt) / totalVentasAnt) * 100 
      : 0;
    const variacionUtilidad = utilidadAnt > 0 
      ? ((processedData.resumen.utilidad - utilidadAnt) / utilidadAnt) * 100 
      : 0;
    const variacionGastos = totalGastosAnt > 0 
      ? ((processedData.resumen.gastos - totalGastosAnt) / totalGastosAnt) * 100 
      : 0;

    setDatosComparativos({
      ventasAnterior: totalVentasAnt,
      comprasAnterior: totalComprasAnt,
      gastosAnterior: totalGastosAnt,
      utilidadAnterior: utilidadAnt,
      variacionVentas: variacionVentas,
      variacionUtilidad: variacionUtilidad,
      variacionGastos: variacionGastos
    });
  } else {
    setDatosComparativos(null);
  }

  setLoading(false);

    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };

  const getPeriodoAnterior = (range) => {
    const today = getTodayInBogota();
    let startDateISO, endDateISO;
  
    switch (range) {
      case 'today':
        // Ayer
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        startDateISO = getStartOfDayInBogota(yesterdayStr);
        endDateISO = getEndOfDayInBogota(yesterdayStr);
        break;
        
      case 'week':
        // Semana anterior (días 14 a 8 días atrás)
        const twoWeeksAgo = new Date(today);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];
        
        const eightDaysAgo = new Date(today);
        eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
        const eightDaysAgoStr = eightDaysAgo.toISOString().split('T')[0];
        
        startDateISO = getStartOfDayInBogota(twoWeeksAgoStr);
        endDateISO = getEndOfDayInBogota(eightDaysAgoStr);
        break;
        
      case 'month':
        // Mes anterior
        const lastMonthDate = new Date(today);
        lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
        const lastMonthStr = lastMonthDate.toISOString().split('T')[0];
        const firstDayLastMonth = lastMonthStr.substring(0, 8) + '01';
        
        // Último día del mes anterior
        const lastDayLastMonth = new Date(today.substring(0, 8) + '01');
        lastDayLastMonth.setDate(lastDayLastMonth.getDate() - 1);
        const lastDayLastMonthStr = lastDayLastMonth.toISOString().split('T')[0];
        
        startDateISO = getStartOfDayInBogota(firstDayLastMonth);
        endDateISO = getEndOfDayInBogota(lastDayLastMonthStr);
        break;
        
      default:
        // Para custom, usar el mismo rango de días pero en período anterior
        startDateISO = getStartOfDayInBogota(today);
        endDateISO = getEndOfDayInBogota(today);
    }
  
    return { startDate: startDateISO, endDate: endDateISO };
  };

  const getDateRange = (range) => {
    const today = getTodayInBogota();
    let startDateISO, endDateISO, displayStart, displayEnd;
  
    switch (range) {
      case 'today':
        startDateISO = getStartOfDayInBogota(today);
        endDateISO = getEndOfDayInBogota(today);
        displayStart = today;
        displayEnd = today;
        break;
        
      case 'week':
        const weekAgoDate = new Date(today);
        weekAgoDate.setDate(weekAgoDate.getDate() - 7);
        const weekAgo = weekAgoDate.toISOString().split('T')[0];
        
        startDateISO = getStartOfDayInBogota(weekAgo);
        endDateISO = getEndOfDayInBogota(today);
        displayStart = weekAgo;
        displayEnd = today;
        break;
        
      case 'month':
        const firstDayOfMonth = today.substring(0, 8) + '01';
        
        startDateISO = getStartOfDayInBogota(firstDayOfMonth);
        endDateISO = getEndOfDayInBogota(today);
        displayStart = firstDayOfMonth;
        displayEnd = today;
        break;
        
      case 'custom':
        if (startDate && endDate) {
          startDateISO = getStartOfDayInBogota(startDate);
          endDateISO = getEndOfDayInBogota(endDate);
          displayStart = startDate;
          displayEnd = endDate;
        } else {
          startDateISO = getStartOfDayInBogota(today);
          endDateISO = getEndOfDayInBogota(today);
          displayStart = today;
          displayEnd = today;
        }
        break;
        
      default:
        startDateISO = getStartOfDayInBogota(today);
        endDateISO = getEndOfDayInBogota(today);
        displayStart = today;
        displayEnd = today;
    }
  
    return { 
      startDate: startDateISO, 
      endDate: endDateISO,
      displayStart: displayStart,
      displayEnd: displayEnd
    };
  };

  // Incluir mermas en gastos totales
  const processDashboardData = (ventas, compras, consumos, gastos, productos, mermas) => {
    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    const totalCompras = compras.reduce((sum, c) => sum + parseFloat(c.costo_total || 0), 0);
    const totalConsumos = consumos.reduce((sum, c) => sum + parseFloat(c.costo_total || 0), 0);
    const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
    
    // Sumar costo de mermas a gastos
    const totalMermas = (mermas || []).reduce((sum, m) => sum + parseFloat(m.costo_total || 0), 0);
    const totalGastosConMermas = totalGastos + totalMermas;
    
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

    
    const productoMayorRotacion = topProductos.length > 0 ? topProductos[0].nombre : 'N/A';

    return {
      resumen: {
        ventas: totalVentas,
        compras: totalCompras,
        consumos: totalConsumos,
        gastos: totalGastosConMermas,
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
        mayorRotacion: productoMayorRotacion,
        masRentable: masRentable ? masRentable.nombre : 'N/A',
        variacion: 0
      }
    };
  };

  const getVentasPorDia = (ventas, compras, gastos) => {
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diasOrdenados = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const ventasPorDia = {};

    // Inicializar todos los días de Lunes a Domingo con valores en 0
    diasOrdenados.forEach(dia => {
      ventasPorDia[dia] = { dia, ventas: 0, compras: 0, gastos: 0 };
    });

    ventas.forEach(v => {
      const fecha = new Date(v.created_at);
      const dia = diasSemana[fecha.getDay()];
      if (ventasPorDia[dia]) {
        ventasPorDia[dia].ventas += parseFloat(v.total || 0);
      }
    });

    compras.forEach(c => {
      const fecha = new Date(c.created_at);
      const dia = diasSemana[fecha.getDay()];
      if (ventasPorDia[dia]) {
        ventasPorDia[dia].compras += parseFloat(c.costo_total || 0);
      }
    });

    gastos.forEach(g => {
      const fecha = new Date(g.created_at);
      const dia = diasSemana[fecha.getDay()];
      if (ventasPorDia[dia]) {
        ventasPorDia[dia].gastos += parseFloat(g.monto || 0);
      }
    });

    // Retornar en orden Lunes a Domingo
    return diasOrdenados.map(dia => ventasPorDia[dia]);
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
          fecha: new Date(v.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
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
        fecha: new Date(c.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
      });
    });

    consumos.slice(0, 5).forEach(c => {
      const producto = productos.find(p => p.producto_id === c.producto_id);
      movimientos.push({
        tipo: 'Consumo',
        producto: producto?.producto || 'Producto desconocido',
        cantidad: parseFloat(c.cantidad || 0),
        valor: parseFloat(c.costo_total || 0),
        fecha: new Date(c.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
      });
    });

    return movimientos
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 10);
  };

  const handleAbrirCierre = async () => {
    const { startDate: start, endDate: end } = getDateRange(dateRange);
    
    const { data: cierreExistente } = await supabase
      .from('cierres')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('tipo_cierre', dateRange)
      .limit(1);

    if (cierreExistente && cierreExistente.length > 0) {
      alert('Ya existe un cierre para este período. Seleccione otro rango de fechas.');
      return;
    }

    const cajaEsperada = dashboardData.resumen.ventas - dashboardData.resumen.compras - dashboardData.resumen.gastos;

    // Inicializar stock contado vacío
    const stockContadoInicial = {};
    allProductos.forEach(producto => {
      stockContadoInicial[producto.producto_id] = '';
    });

    setCierreData({
      cajaEsperada,
      ventasTotal: dashboardData.resumen.ventas,
      comprasTotal: dashboardData.resumen.compras,
      gastosTotal: dashboardData.resumen.gastos,
      consumosTotal: dashboardData.resumen.consumos,
      utilidadNeta: dashboardData.resumen.utilidad,
      periodoCierre: {
        inicio: currentDateRange.start,
        fin: currentDateRange.end
      }
    });

    setStockContadoPorProducto(stockContadoInicial);
    setModoCierre('rapido'); // Por defecto, modo rápido
    setProductosParaCierre([]); // Se llenará según el modo
    setShowCierreModal(true);
    setCierreStep(1);
    setCajaContada('');
    setNotasCierre('');
  };

  const getProductosCriticos = () => {
    // Productos con movimiento o stock bajo
    const productosConMovimiento = dashboardData.topProductos.map(p => p.nombre);
    const productosStockBajo = allProductos.filter(p => parseFloat(p.stock_actual) < 10);
    
    return allProductos.filter(producto => 
      productosConMovimiento.includes(producto.producto) || 
      parseFloat(producto.stock_actual) < 10
    );
  };

  const handleProcesarCierre = () => {
    if (!cajaContada || parseFloat(cajaContada) < 0) {
      alert('Por favor ingrese el dinero en caja');
      return;
    }

    // Validar según el modo de cierre
    if (modoCierre === 'completo') {
      const productosSinStock = allProductos.filter(p => 
        stockContadoPorProducto[p.producto_id] === '' || 
        stockContadoPorProducto[p.producto_id] === undefined ||
        isNaN(parseFloat(stockContadoPorProducto[p.producto_id]))
      );

      if (productosSinStock.length > 0) {
        alert(`⚠️ Por favor ingrese el stock contado para TODOS los productos.\n\nFaltan: ${productosSinStock.map(p => p.producto).join(', ')}`);
        return;
      }
    } else if (modoCierre === 'critico') {
      const productosValidar = productosParaCierre;
      const productosSinStock = productosValidar.filter(p => 
        stockContadoPorProducto[p.producto_id] === '' || 
        stockContadoPorProducto[p.producto_id] === undefined ||
        isNaN(parseFloat(stockContadoPorProducto[p.producto_id]))
      );

      if (productosSinStock.length > 0) {
        alert(`⚠️ Por favor ingrese el stock de productos críticos.\n\nFaltan: ${productosSinStock.map(p => p.producto).join(', ')}`);
        return;
      }

      // Para productos no incluidos, usar stock actual
      allProductos.forEach(producto => {
        if (!productosValidar.find(p => p.producto_id === producto.producto_id)) {
          stockContadoPorProducto[producto.producto_id] = producto.stock_actual;
        }
      });
      setStockContadoPorProducto({...stockContadoPorProducto});
    } else if (modoCierre === 'rapido') {
      // Cierre rápido: usar stock actual para todos
      const stockRapido = {};
      allProductos.forEach(producto => {
        stockRapido[producto.producto_id] = producto.stock_actual;
      });
      setStockContadoPorProducto(stockRapido);
    }

    setCierreStep(2);
  };

  // ✅ CORRECCIÓN: Actualizar stock_actual con el stock_contado del cierre
  const handleGuardarCierre = async () => {
    setSavingCierre(true);
    
    try {
      const cajaReal = parseFloat(cajaContada);
      const diferenciaCaja = cierreData.cajaEsperada - cajaReal;
      
      let inventarioContado = 0;
      allProductos.forEach(producto => {
        const stockContado = parseFloat(stockContadoPorProducto[producto.producto_id]) || 0;
        inventarioContado += stockContado;
      });

      const diferenciaInventarioTotal = inventarioContado - 
        allProductos.reduce((sum, p) => sum + parseFloat(p.stock_actual || 0), 0);

      const cuadrado = diferenciaCaja === 0 && diferenciaInventarioTotal === 0;

      const cierreRecord = {
        tenant_id: tenantId,
        periodo_inicio: cierreData.periodoCierre.inicio,
        periodo_fin: cierreData.periodoCierre.fin,
        tipo_cierre: dateRange,
        ventas_total: cierreData.ventasTotal,
        compras_total: cierreData.comprasTotal,
        consumo_personal_total: cierreData.consumosTotal,
        gastos_total: cierreData.gastosTotal,
        utilidad_neta: cierreData.utilidadNeta,
        caja_inicial: 0,
        caja_esperada: cierreData.cajaEsperada,
        caja_real: cajaReal,
        diferencia_caja: diferenciaCaja,
        inventario_esperado: allProductos.reduce((sum, p) => sum + parseFloat(p.stock_actual || 0), 0),
        inventario_real: inventarioContado,
        diferencia_inventario: diferenciaInventarioTotal,
        cuadrado: cuadrado,
        notas: notasCierre,
        base_siguiente_periodo: parseFloat(baseProximoPeriodo) || 0,
        created_at: new Date().toISOString()
      };

      // 1. Insertar el cierre
      const { data: cierreInsertado, error: cierreError } = await supabase
        .from('cierres')
        .insert([cierreRecord])
        .select();

      if (cierreError) throw cierreError;

      const cierreId = cierreInsertado[0].id;
      console.log('✅ Cierre guardado con ID:', cierreId);

      // 2. Guardar detalles en cierre_inventario
      const cierreInventarioRecords = [];
      
      for (const producto of allProductos) {
        const stockContado = parseFloat(stockContadoPorProducto[producto.producto_id]) || 0;
        const stockEsperado = parseFloat(producto.stock_actual || 0);
        const diferencia = stockContado - stockEsperado;

        cierreInventarioRecords.push({
          cierre_id: cierreId,
          tenant_id: tenantId,
          producto_id: producto.producto_id,
          stock_inicio_periodo: stockEsperado,
          stock_comprado: 0,
          stock_vendido: 0,
          stock_consumido: 0,
          stock_mermas: 0,
          stock_esperado: stockEsperado,
          stock_contado: stockContado,
          diferencia: diferencia,
          created_at: new Date().toISOString()
        });
      }

      if (cierreInventarioRecords.length > 0) {
        const { error: inventarioError } = await supabase
          .from('cierre_inventario')
          .insert(cierreInventarioRecords);

        if (inventarioError) throw inventarioError;
        console.log('✅ Registros de cierre_inventario insertados:', cierreInventarioRecords.length);
      }

      // ✅ 3. NUEVO: Actualizar stock_actual de cada producto con el stock_contado del cierre
      // Esto asegura que el próximo período comience con los números correctos
      for (const producto of allProductos) {
        const stockContado = parseFloat(stockContadoPorProducto[producto.producto_id]) || 0;
        
        const { error: updateError } = await supabase
          .from('productos')
          .update({ 
            stock_actual: stockContado,
            stock_inicial: stockContado
          })
          .eq('producto_id', producto.producto_id)
          .eq('tenant_id', tenantId);

        if (updateError) {
          console.error(`Error actualizando stock del producto ${producto.producto_id}:`, updateError);
          throw updateError;
        }
      }

      console.log('✅ Stock de todos los productos actualizado al stock contado');

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

  const handleExportPDF = () => {
    window.print();
  };

  const handleGuardarBase = async () => {
    try {
      // Aquí guardarías la base en Supabase
      // Por ahora solo actualizamos el estado local
      alert(`✅ Base actualizada a: ${formatCurrency(parseFloat(baseActual))}`);
      setShowBaseModal(false);
    } catch (error) {
      console.error('Error guardando base:', error);
      alert('Error al guardar la base: ' + error.message);
    }
  };

  const handleGuardarInventario = async () => {
    try {
      // Aquí guardarías los cambios de inventario en Supabase
      alert('✅ Inventario actualizado exitosamente');
      setShowInventarioModal(false);
      // Recargar datos del dashboard
      setLoading(true);
      loadDashboardData(tenantId);
    } catch (error) {
      console.error('Error guardando inventario:', error);
      alert('Error al guardar inventario: ' + error.message);
    }
  };

  const handleGuardarApodos = async () => {
    try {
      // Aquí guardarías los apodos en Supabase
      alert('✅ Apodos guardados exitosamente');
      setShowApodosModal(false);
    } catch (error) {
      console.error('Error guardando apodos:', error);
      alert('Error al guardar apodos: ' + error.message);
    }
  };

  const ComparisonBadge = ({ value, isPositiveGood = true }) => {
    if (!value || value === 0) return null;
    
    const isPositive = value > 0;
    const shouldBeGreen = isPositiveGood ? isPositive : !isPositive;
    
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
        shouldBeGreen 
          ? 'bg-green-100 text-green-700' 
          : 'bg-red-100 text-red-700'
      }`}>
        {isPositive ? '↗' : '↘'}
        {Math.abs(value).toFixed(1)}%
      </div>
    );
  };

  const AlertCard = ({ type, title, items, icon: Icon, suggestion }) => {
    const colors = {
      critical: {
        bg: 'bg-red-50',
        border: 'border-red-500',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        textColor: 'text-red-800',
        badgeBg: 'bg-red-600',
        badgeText: 'text-white'
      },
      warning: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-500',
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-600',
        textColor: 'text-yellow-800',
        badgeBg: 'bg-yellow-600',
        badgeText: 'text-white'
      },
      success: {
        bg: 'bg-green-50',
        border: 'border-green-500',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        textColor: 'text-green-800',
        badgeBg: 'bg-green-600',
        badgeText: 'text-white'
      }
    };

    const color = colors[type];

    return (
      <div className={`${color.bg} border-l-4 ${color.border} rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow`}>
        <div className="flex items-start gap-3">
          <div className={`${color.iconBg} p-2 rounded-full flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${color.iconColor}`} />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h4 className={`font-bold ${color.textColor} text-sm`}>{title}</h4>
              {items.length > 0 && (
                <span className={`${color.badgeBg} ${color.badgeText} px-2 py-1 rounded-full text-xs font-bold`}>
                  {items.length}
                </span>
              )}
            </div>

            {items.length > 0 ? (
              <>
                <ul className="space-y-1 mb-3">
                  {items.slice(0, 3).map((item, index) => (
                    <li key={index} className={`text-sm ${color.textColor} flex items-start gap-2`}>
                      <span className="mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                
                {items.length > 3 && (
                  <p className={`text-xs ${color.textColor} italic`}>
                    y {items.length - 3} producto(s) más...
                  </p>
                )}

                {suggestion && (
                  <div className={`mt-3 pt-3 border-t ${color.border}`}>
                    <p className={`text-xs font-semibold ${color.textColor}`}>
                      💡 Sugerencia: {suggestion}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">✓ Todo en orden</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const handleDateRangeChange = (value) => {
    setDateRange(value);
    if (value !== 'custom') {
      setShowDatePicker(false);
    } else {
      setShowDatePicker(true);
    }
  };

  const applyCustomDates = () => {
    if (startDate && endDate) {
      setLoading(true);
      setShowDatePicker(false);
      setDateRange('custom');
      loadDashboardData(tenantId);
    }
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  useEffect(() => {
    if (tenantId && !customDates && dateRange !== 'custom') {
      setLoading(true);
      loadDashboardData(tenantId);
    }
  }, [dateRange]);

  const sortedProducts = dashboardData?.topProductos ? [...dashboardData.topProductos].sort((a, b) => {
    switch (sortBy) {
      case 'ventas':
        return b.total - a.total;
      case 'stock':
        return b.stock - a.stock;
      case 'margen':
        return b.margen - a.margen;
      default:
        return 0;
    }
  }) : [];

  const filteredMovements = dashboardData?.movimientos ? 
    filterMovement === 'todos' ? dashboardData.movimientos :
    dashboardData.movimientos.filter(m => m.tipo.toLowerCase() === filterMovement.toLowerCase())
    : [];

  const gastosPorCategoria = {};
  gastosDelPeriodo.forEach(gasto => {
    const categoria = gasto.categoria || 'Sin categoría';
    if (!gastosPorCategoria[categoria]) {
      gastosPorCategoria[categoria] = 0;
    }
    gastosPorCategoria[categoria] += parseFloat(gasto.monto || 0);
  });

  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
            <p className="text-gray-600 mb-4">El token proporcionado es inválido o ha expirado.</p>
            <p className="text-sm text-gray-500">Por favor, solicita un nuevo enlace de acceso al dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando datos del dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Sin datos</h2>
          <p className="text-gray-600">No se pudieron cargar los datos del dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4 sm:p-6 pb-24 sm:pb-6">
      <div className="max-w-7xl mx-auto">
        {/* Header con Fechas Visibles */}
<div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg p-4 sm:p-6 mb-6 text-white">
  {/* VERSIÓN MÓVIL */}
  <div className="block sm:hidden">
    {/* Fila 1: Título y Menú Hamburguesa */}
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <ShoppingBag className="w-7 h-7" />
        <h1 className="text-xl font-bold">Tienda el Castillo</h1>
      </div>
    </div>

    {/* Fila 2: Propietario */}
    <p className="text-emerald-100 text-xs mb-3">Propietario: Alejandro Castillo</p>

    {/* Fila 3: Fechas */}
    <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2 mb-3">
      <Calendar className="w-4 h-4" />
      <span className="font-semibold text-xs">
        {formatDateToDisplay(currentDateRange.start)} - {formatDateToDisplay(currentDateRange.end)}
      </span>
    </div>

    {/* Fila 4: Botones */}
    <div className="flex flex-col gap-2">
      
      <button
        onClick={() => {
          setLoading(true);
          loadDashboardData(tenantId);
        }}
        className="flex items-center justify-center gap-2 bg-white text-emerald-600 px-4 py-2 rounded-lg font-semibold hover:bg-emerald-50 transition-colors shadow-md text-sm"
      >
        <RefreshCw className="w-4 h-4" />
        Refrescar Datos
      </button>
      <button
        onClick={handleExportPDF}
        className="flex items-center justify-center gap-2 bg-white text-emerald-600 px-4 py-2 rounded-lg font-semibold hover:bg-emerald-50 transition-colors shadow-md text-sm"
      >
        <Download className="w-4 h-4" />
        Exportar PDF
      </button>
    </div>
  </div>

  {/* VERSIÓN DESKTOP */}
  <div className="hidden sm:flex sm:items-center sm:justify-between gap-4">
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ShoppingBag className="w-8 h-8" />
        <h1 className="text-2xl sm:text-3xl font-bold">Tienda el Castillo</h1>
      </div>
      <p className="text-emerald-100 text-sm">Propietario: Alejandro Castillo</p>
      
      <div className="flex items-center gap-2 mt-3 bg-white/20 rounded-lg px-4 py-2 inline-block">
        <Calendar className="w-5 h-5" />
        <span className="font-semibold text-sm">
          {formatDateToDisplay(currentDateRange.start)} - {formatDateToDisplay(currentDateRange.end)}
        </span>
      </div>
    </div>
    
    <div className="flex flex-col sm:flex-row gap-3">
      
      <button
        onClick={() => {
          setLoading(true);
          loadDashboardData(tenantId);
        }}
        className="flex items-center justify-center gap-2 bg-white text-emerald-600 px-6 py-2 rounded-lg font-semibold hover:bg-emerald-50 transition-colors shadow-md"
      >
        <RefreshCw className="w-5 h-5" />
        Refrescar Datos
      </button>
      <button
        onClick={handleExportPDF}
        className="flex items-center justify-center gap-2 bg-white text-emerald-600 px-6 py-2 rounded-lg font-semibold hover:bg-emerald-50 transition-colors shadow-md"
      >
        <Download className="w-5 h-5" />
        Exportar PDF
      </button>

    </div>
  </div>

            {/* TABS PARA DESKTOP - Horizontal */}
            <div className="hidden sm:block bg-white rounded-lg shadow-md mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200">
          <button
              onClick={() => setActiveTab('hoy')}
              className={`flex-1 px-6 py-4 font-semibold transition-all duration-200 ${
                activeTab === 'hoy'
                  ? 'bg-emerald-600 text-white border-b-4 border-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-emerald-600'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Hoy</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('resumen')}
              className={`flex-1 px-6 py-4 font-semibold transition-all duration-200 ${
                activeTab === 'resumen'
                  ? 'bg-emerald-600 text-white border-b-4 border-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-emerald-600'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Resumen</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('detalles')}
              className={`flex-1 px-6 py-4 font-semibold transition-all duration-200 ${
                activeTab === 'detalles'
                  ? 'bg-emerald-600 text-white border-b-4 border-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-emerald-600'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Detalles</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('gestion')}
              className={`flex-1 px-6 py-4 font-semibold transition-all duration-200 ${
                activeTab === 'gestion'
                  ? 'bg-emerald-600 text-white border-b-4 border-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-emerald-600'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Gestión</span>
              </div>
            </button>
          </div>
        </div>

        {/* TABS PARA MÓVIL - Bottom Navigation Fixed */}
        <div className="block sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
          <div className="flex justify-around items-center max-w-7xl mx-auto">
          <button
              onClick={() => setActiveTab('hoy')}
              className={`flex-1 px-6 py-4 font-semibold transition-all duration-200 ${
                activeTab === 'hoy'
                  ? 'bg-emerald-600 text-white border-b-4 border-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-emerald-600'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Hoy</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('resumen')}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors font-semibold border-t-4 ${
                activeTab === 'resumen'
                  ? 'text-emerald-600 border-emerald-600'
                  : 'text-gray-600 border-transparent hover:text-emerald-600'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="text-xs">Resumen</span>
            </button>

            <button
              onClick={() => setActiveTab('detalles')}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors font-semibold border-t-4 ${
                activeTab === 'detalles'
                  ? 'text-emerald-600 border-emerald-600'
                  : 'text-gray-600 border-transparent hover:text-emerald-600'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs">Detalles</span>
            </button>

            <button
              onClick={() => setActiveTab('gestion')}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors font-semibold border-t-4 ${
                activeTab === 'gestion'
                  ? 'text-emerald-600 border-emerald-600'
                  : 'text-gray-600 border-transparent hover:text-emerald-600'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs">Gestión</span>
            </button>
          </div>
        </div>


</div>

        {/* Selector de Rango de Fechas - Solo en tabs Resumen y Detalles */}
        {(activeTab === 'resumen' || activeTab === 'detalles') && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <label className="text-gray-700 font-medium">Período:</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleDateRangeChange('today')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  dateRange === 'today'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => handleDateRangeChange('week')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  dateRange === 'week'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Última Semana
              </button>
              <button
                onClick={() => handleDateRangeChange('month')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  dateRange === 'month'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Este Mes
              </button>
              <button
                onClick={() => handleDateRangeChange('custom')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  dateRange === 'custom'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Personalizado
              </button>
            </div>
          </div>

          {showDatePicker && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border-2 border-emerald-200">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Inicio</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Fin</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={applyCustomDates}
                  disabled={!startDate || !endDate}
                  className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                    startDate && endDate
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}      
        </div>
        )}

        {/* ========== TAB: HOY ========== */}
        {activeTab === 'hoy' && (
          <div className="space-y-6">

            {/* Mensaje si no es "hoy" el período seleccionado */}
            {dateRange !== 'today' && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4">
                <p className="text-amber-800">
                  ⚠️ <strong>Nota:</strong> Estás viendo datos del período seleccionado, no solo de hoy. 
                  Para ver datos en tiempo real del día actual, selecciona "Hoy" en el selector de período.
                </p>
              </div>
            )}

            {/* RESUMEN RÁPIDO DE ALERTAS */}
            {(dashboardData.alertas.stockBajo.length > 0 || dashboardData.alertas.sinMovimiento.length > 0) && (
              <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-lg shadow-xl p-4 mb-6 text-white animate-pulse">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-8 h-8" />
                    <div>
                      <p className="font-bold text-lg">¡Atención Requerida!</p>
                      <p className="text-sm opacity-90">
                        {dashboardData.alertas.stockBajo.length > 0 && `${dashboardData.alertas.stockBajo.length} producto(s) con stock bajo`}
                        {dashboardData.alertas.stockBajo.length > 0 && dashboardData.alertas.sinMovimiento.length > 0 && ' • '}
                        {dashboardData.alertas.sinMovimiento.length > 0 && `${dashboardData.alertas.sinMovimiento.length} sin movimiento`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // Scroll suave hacia las alertas
                      document.querySelector('[data-alertas]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    Ver Detalles
                    <AlertCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

        {/* Resumen Ejecutivo con Comparativas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-emerald-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-gray-600 text-sm font-medium">Total Ventas</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.ventas)}</p>
                {datosComparativos && (
                  <div className="mt-2 flex items-center gap-2">
                    <ComparisonBadge value={datosComparativos.variacionVentas} isPositiveGood={true} />
                    <span className="text-xs text-gray-500">vs período anterior</span>
                  </div>
                )}
              </div>
              <div className="bg-emerald-100 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-gray-600 text-sm font-medium">Total Compras</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.compras)}</p>
                {datosComparativos && datosComparativos.comprasAnterior > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500">
                      Anterior: {formatCurrency(datosComparativos.comprasAnterior)}
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-gray-600 text-sm font-medium">Total Gastos</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.gastos)}</p>
                {datosComparativos && (
                  <div className="mt-2 flex items-center gap-2">
                    <ComparisonBadge value={datosComparativos.variacionGastos} isPositiveGood={false} />
                    <span className="text-xs text-gray-500">vs período anterior</span>
                  </div>
                )}
              </div>
              <div className="bg-amber-100 p-3 rounded-full">
                <Package className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-gray-600 text-sm font-medium">Utilidad Bruta</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.utilidad)}</p>
                {datosComparativos && (
                  <div className="mt-2 flex items-center gap-2">
                    <ComparisonBadge value={datosComparativos.variacionUtilidad} isPositiveGood={true} />
                    <span className="text-xs text-gray-500">vs período anterior</span>
                  </div>
                )}
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* ALERTAS CRÍTICAS - Prioridad Alta */}
        <div data-alertas className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-4 sm:p-6 mb-6 border-2 border-red-200 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-600 p-2 rounded-full animate-pulse">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-red-900">
              ⚠️ Alertas Críticas
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <AlertCard
              type="critical"
              title="Stock Bajo - Requiere Acción"
              items={dashboardData.alertas.stockBajo}
              icon={AlertCircle}
              suggestion={dashboardData.alertas.stockBajo.length > 0 ? `Reponer ${dashboardData.alertas.stockBajo[0].split(' (')[0]} cuanto antes` : null}
            />

            <AlertCard
              type="warning"
              title="Productos Sin Movimiento"
              items={dashboardData.alertas.sinMovimiento}
              icon={AlertTriangle}
              suggestion={dashboardData.alertas.sinMovimiento.length > 0 ? "Considere promocionar estos productos" : null}
            />
          </div>

          {(dashboardData.alertas.stockBajo.length > 0 || dashboardData.alertas.sinMovimiento.length > 0) && (
            <div className="bg-white rounded-lg p-3 border border-red-300">
              <p className="text-sm text-red-900 font-semibold">
                🔔 <strong>Acción requerida:</strong> {dashboardData.alertas.stockBajo.length} producto(s) con stock crítico y {dashboardData.alertas.sinMovimiento.length} sin movimiento en este período.
              </p>
            </div>
          )}
        </div>

        {/* INFORMACIÓN POSITIVA */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 sm:p-6 mb-6 border-2 border-green-200 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-600 p-2 rounded-full">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-green-900">
              ✅ Destacados del Período
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 border-2 border-green-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-green-100 p-2 rounded-full">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <h4 className="font-bold text-green-900">Más Rentable</h4>
              </div>
              <p className="text-lg font-bold text-green-700 mb-2">
                {dashboardData.alertas.masRentable}
              </p>
              <p className="text-xs text-green-600">
                Este producto ofrece el mejor margen de utilidad
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-blue-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-blue-100 p-2 rounded-full">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <h4 className="font-bold text-blue-900">Mayor Rotación</h4>
              </div>
              <p className="text-lg font-bold text-blue-700 mb-2">
                {dashboardData.kpis.mayorRotacion}
              </p>
              <p className="text-xs text-blue-600">
                El producto más vendido del período
              </p>
            </div>
          </div>
        </div>

        {/* Top 3 Productos del Día */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                Top 3 Productos Más Vendidos Hoy
              </h3>
              {dashboardData.topProductos && dashboardData.topProductos.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.topProductos.slice(0, 3).map((producto, index) => {
                    const medallas = ['🥇', '🥈', '🥉'];
                    const colores = ['bg-yellow-50 border-yellow-300', 'bg-gray-50 border-gray-300', 'bg-orange-50 border-orange-300'];
                    return (
                      <div key={index} className={`border-2 ${colores[index]} rounded-lg p-4`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{medallas[index]}</span>
                            <div>
                              <p className="font-bold text-gray-900 text-lg">{producto.nombre}</p>
                              <p className="text-sm text-gray-600">Vendidos: {producto.vendidos} und</p>
                            </div>
                          </div>
                          <p className="text-xl font-bold text-emerald-600">{formatCurrency(producto.total)}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>📦 Stock: {Math.round(producto.stock)} und</span>
                          <span>💰 Margen: {producto.margen}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No hay ventas registradas hoy</p>
              )}
            </div>

          </div>
        )}

        {/* ========== TAB: RESUMEN ========== */}
        {activeTab === 'resumen' && (
          <div className="space-y-6">

        {/* Resumen Ejecutivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-emerald-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-gray-600 text-sm font-medium">Total Ventas</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.ventas)}</p>
                {datosComparativos && (
                  <div className="mt-2 flex items-center gap-2">
                    <ComparisonBadge value={datosComparativos.variacionVentas} isPositiveGood={true} />
                    <span className="text-xs text-gray-500">vs período anterior</span>
                  </div>
                )}
              </div>
              <div className="bg-emerald-100 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-gray-600 text-sm font-medium">Total Compras</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.compras)}</p>
                {datosComparativos && datosComparativos.comprasAnterior > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500">
                      Anterior: {formatCurrency(datosComparativos.comprasAnterior)}
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-gray-600 text-sm font-medium">Total Gastos</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.gastos)}</p>
                {datosComparativos && (
                  <div className="mt-2 flex items-center gap-2">
                    <ComparisonBadge value={datosComparativos.variacionGastos} isPositiveGood={false} />
                    <span className="text-xs text-gray-500">vs período anterior</span>
                  </div>
                )}
              </div>
              <div className="bg-amber-100 p-3 rounded-full">
                <Package className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-gray-600 text-sm font-medium">Utilidad Bruta</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.utilidad)}</p>
                {datosComparativos && (
                  <div className="mt-2 flex items-center gap-2">
                    <ComparisonBadge value={datosComparativos.variacionUtilidad} isPositiveGood={true} />
                    <span className="text-xs text-gray-500">vs período anterior</span>
                  </div>
                )}
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

            {/* VERSIÓN DESKTOP - Gráfico de Barras */}
            <div className="hidden md:block">
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

            {/* VERSIÓN MÓVIL - Timeline Vertical */}
            <div className="block md:hidden space-y-4">
              {dashboardData.ventasSemanales.map((dia, index) => {
                const total = dia.ventas + dia.compras + dia.gastos;
                const maxValor = Math.max(...dashboardData.ventasSemanales.map(d => Math.max(d.ventas, d.compras, d.gastos))) * 1.1;
                const esMejorDia = dia.ventas === Math.max(...dashboardData.ventasSemanales.map(d => d.ventas));

                return (
                  <div key={index} className="border-l-4 border-gray-300 pl-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-800">{dia.dia}</span>
                        {esMejorDia && dia.ventas > 0 && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                            💰 Mejor día
                          </span>
                        )}
                      </div>
                      
                    </div>

                    <div className="space-y-2">
                      {/* Ventas */}
                      {dia.ventas > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-600">💰 Ventas</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(dia.ventas)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div 
                              className="h-2.5 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${(dia.ventas / maxValor) * 100}%`,
                                backgroundColor: '#10b981'
                              }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Compras */}
                      {dia.compras > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-600">🛒 Compras</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(dia.compras)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div 
                              className="h-2.5 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${(dia.compras / maxValor) * 100}%`,
                                backgroundColor: '#3b82f6'
                              }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Gastos */}
                      {dia.gastos > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-600">📦 Gastos</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(dia.gastos)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div 
                              className="h-2.5 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${(dia.gastos / maxValor) * 100}%`,
                                backgroundColor: '#f59e0b'
                              }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Mensaje cuando no hay actividad */}
                      {dia.ventas === 0 && dia.compras === 0 && dia.gastos === 0 && (
                        <p className="text-sm text-gray-400 italic">Sin actividad registrada</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
  <h3 className="text-lg font-bold text-gray-800 mb-4">🏆 Top 5 Productos Mayor Rotación</h3>
  {dashboardData.topProductos && dashboardData.topProductos.length > 0 ? (
    <div className="space-y-4">
      {dashboardData.topProductos.slice(0, 5).map((producto, index) => {
        const porcentaje = dashboardData.resumen.ventas > 0 
          ? Math.round((producto.total / dashboardData.resumen.ventas) * 100) 
          : 0;
        
        // Emojis de medallas
        const medallas = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const coloresBarra = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];
        
        return (
          <div key={index} className="border-b border-gray-100 pb-4 last:border-b-0">
            {/* Header con medalla y nombre */}
            <div className="flex items-start gap-2 mb-2">
              <span className="text-2xl">{medallas[index]}</span>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-base">
                  {index + 1}. {producto.nombre}
                </p>
                <p className="text-sm text-gray-600">
                  Vendidos: <span className="font-semibold">{producto.vendidos} und</span>
                </p>
              </div>
            </div>

            {/* Barra de progreso con valor y porcentaje */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-bold text-gray-900">{formatCurrency(producto.total)}</span>
                <span className="font-semibold text-gray-600">{porcentaje}%</span>
              </div>
              
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${porcentaje}%`,
                    backgroundColor: coloresBarra[index]
                  }}
                ></div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
      <Package className="w-16 h-16 mb-2 opacity-50" />
      <p>No hay datos de productos para mostrar</p>
    </div>
  )}
</div>
        </div>

            {/* Tabla de Gastos por Categoría */}

{Object.keys(gastosPorCategoria).length > 0 && (
  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
    <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Desglose de Gastos por Categoría</h3>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
            {(dateRange === 'today' || dateRange === 'week') && (
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Object.entries(gastosPorCategoria).map(([categoria, monto], index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{categoria}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(monto)}</td>
              {(dateRange === 'today' || dateRange === 'week') && (
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => {
                      setCategoriaSeleccionada(categoria);
                      setShowConceptosModal(true);
                    }}
                    className="text-emerald-600 hover:text-emerald-800 font-semibold text-sm underline"
                  >
                    Ver
                  </button>
                </td>
              )}
            </tr>
          ))}
          <tr className="bg-gray-100 font-bold">
            <td className="px-4 py-3 text-sm text-gray-900">TOTAL GASTOS</td>
            <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(dashboardData.resumen.gastos)}</td>
            {(dateRange === 'today' || dateRange === 'week') && <td></td>}
          </tr>
        </tbody>
      </table>
    </div>
  </div>
)}



          {/* Indicadores Clave */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Indicadores Clave de Rendimiento</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-700 font-medium mb-1">Mayor Rotación</p>
              <p className="text-lg font-bold text-blue-900">{dashboardData.kpis.mayorRotacion}</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
              <p className="text-sm text-purple-700 font-medium mb-1">Más Rentable</p>
              <p className="text-lg font-bold text-purple-900">{dashboardData.kpis.masRentable}</p>
            </div>
            
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4">
              <p className="text-sm text-amber-700 font-medium mb-1">Total Productos</p>
              <p className="text-2xl font-bold text-amber-900">{allProductos.length}</p>
            </div>
          </div>
        </div>

        </div>
        )}

        {/* ========== TAB: DETALLES ========== */}
        {activeTab === 'detalles' && (
          <div className="space-y-6">

        {/* Tabla Top Productos */}
        {sortedProducts.length > 0 && (
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
                          {Math.round(producto.stock)} und
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
        )}

        {/* Últimos Movimientos */}
        {filteredMovements.length > 0 && (
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
                      <td className="px-4 py-3 text-sm text-gray-900">{Math.round(mov.cantidad * 100) / 100}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(mov.valor)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{mov.fecha}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
        )}

        {/* ========== TAB: GESTIÓN ========== */}
        {activeTab === 'gestion' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-l-4 border-blue-500">
              <h3 className="text-xl font-bold text-blue-900 mb-4">⚙️ Opciones de Gestión</h3>
              <p className="text-blue-800 mb-6">Administra la configuración y realiza el cierre del período.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleAbrirCierre}
                  className="flex items-center gap-3 bg-white p-4 rounded-lg shadow hover:shadow-md transition-all hover:scale-105 border-2 border-blue-200"
                >
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Hacer Cierre</p>
                    <p className="text-sm text-gray-600">Cierre del período actual</p>
                  </div>
                </button>

                <button
                  onClick={() => setShowBaseModal(true)}
                  className="flex items-center gap-3 bg-white p-4 rounded-lg shadow hover:shadow-md transition-all hover:scale-105 border-2 border-blue-200"
                >
                  <DollarSign className="w-8 h-8 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Modificar Base</p>
                    <p className="text-sm text-gray-600">Base inicial del período</p>
                  </div>
                </button>

                <button
                  onClick={() => setShowInventarioModal(true)}
                  className="flex items-center gap-3 bg-white p-4 rounded-lg shadow hover:shadow-md transition-all hover:scale-105 border-2 border-blue-200"
                >
                  <Package className="w-8 h-8 text-blue-600" />
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Modificar Inventario</p>
                    <p className="text-sm text-gray-600">Ajustar stock de productos</p>
                  </div>
                </button>

                <button
                  onClick={() => setShowApodosModal(true)}
                  className="flex items-center gap-3 bg-white p-4 rounded-lg shadow hover:shadow-md transition-all hover:scale-105 border-2 border-blue-200"
                >
                  <Edit2 className="w-8 h-8 text-purple-600" />
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Modificar Apodos</p>
                    <p className="text-sm text-gray-600">Gestionar alias de productos</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Información adicional */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                ℹ️ <strong>Nota:</strong> Los cambios realizados en esta sección afectarán directamente tu inventario y reportes. Asegúrate de tener la información correcta antes de guardar.
              </p>
            </div>
          </div>
        )}

        {/* MODAL DE CIERRE SIMPLIFICADO */}
        {showCierreModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
              {/* Header del Modal */}
              <div className="bg-emerald-600 text-white p-4 sm:p-6 rounded-t-lg sticky top-0 z-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold">Cierre del Período</h2>
                    <p className="text-emerald-100 text-sm sm:text-base mt-2">
                      {formatDateToDisplay(currentDateRange.start)} - {formatDateToDisplay(currentDateRange.end)}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowCierreModal(false)}
                    className="text-white hover:bg-emerald-700 p-2 rounded-lg transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              {/* Contenido del Modal */}
              <div className="p-6">
                {cierreStep === 1 ? (
                  <div className="space-y-6">
                  {/* PASO 0: Selección de Modo de Cierre */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-300">
                    <h3 className="text-xl font-bold text-blue-900 mb-4 text-center">
                      Selecciona el Tipo de Cierre
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {/* Cierre Rápido */}
                      <button
                        onClick={() => {
                          setModoCierre('rapido');
                          setProductosParaCierre([]);
                        }}
                        className={`p-6 rounded-lg border-2 transition-all ${
                          modoCierre === 'rapido'
                            ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg scale-105'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-emerald-400'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-4xl mb-3">🚀</div>
                          <h4 className="font-bold text-lg mb-2">Cierre Rápido</h4>
                          <p className="text-sm opacity-90">
                            Solo caja, sin contar inventario
                          </p>
                          <p className="text-xs mt-2 opacity-75">
                            ⏱️ ~30 segundos
                          </p>
                        </div>
                      </button>

                      {/* Cierre Crítico */}
                      <button
                        onClick={() => {
                          setModoCierre('critico');
                          setProductosParaCierre(getProductosCriticos());
                        }}
                        className={`p-6 rounded-lg border-2 transition-all ${
                          modoCierre === 'critico'
                            ? 'bg-amber-500 border-amber-600 text-white shadow-lg scale-105'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-amber-400'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-4xl mb-3">📦</div>
                          <h4 className="font-bold text-lg mb-2">Cierre Crítico</h4>
                          <p className="text-sm opacity-90">
                            Productos con movimiento y stock bajo
                          </p>
                          <p className="text-xs mt-2 opacity-75">
                            ⏱️ ~2-3 minutos
                          </p>
                        </div>
                      </button>

                      {/* Cierre Completo */}
                      <button
                        onClick={() => {
                          setModoCierre('completo');
                          setProductosParaCierre(allProductos);
                        }}
                        className={`p-6 rounded-lg border-2 transition-all ${
                          modoCierre === 'completo'
                            ? 'bg-purple-500 border-purple-600 text-white shadow-lg scale-105'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-purple-400'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-4xl mb-3">🔍</div>
                          <h4 className="font-bold text-lg mb-2">Cierre Completo</h4>
                          <p className="text-sm opacity-90">
                            Contar todos los productos
                          </p>
                          <p className="text-xs mt-2 opacity-75">
                            ⏱️ ~5-10 minutos
                          </p>
                        </div>
                      </button>
                    </div>

                    {modoCierre === 'critico' && productosParaCierre.length > 0 && (
                      <div className="bg-white rounded-lg p-4 border border-amber-300">
                        <p className="text-sm text-amber-900 font-semibold mb-2">
                          📋 Productos a contar: {productosParaCierre.length} de {allProductos.length}
                        </p>
                        <p className="text-xs text-amber-700">
                          Se contarán solo productos con movimiento reciente y stock bajo. El resto usará el stock del sistema.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Caja Esperada */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Caja Esperada (Sistema)
                    </h3>
                    
                    <div className="bg-white rounded-lg p-4 border border-emerald-200">
                      <p className="text-sm text-gray-600 mb-1">💰 Caja Esperada</p>
                      <p className="text-2xl font-bold text-emerald-700">
                        {formatCurrency(cierreData.cajaEsperada)}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        = Ventas ({formatCurrency(cierreData.ventasTotal)}) - Compras ({formatCurrency(cierreData.comprasTotal)}) - Gastos ({formatCurrency(cierreData.gastosTotal)})
                      </p>
                    </div>
                  </div>

                  {/* Ingreso de Caja */}
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

                  {/* Solo mostrar inventario si NO es cierre rápido */}
                  {modoCierre !== 'rapido' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-bold text-yellow-900 mb-3 flex items-center gap-2">
                        <Edit2 className="w-5 h-5" />
                        {modoCierre === 'critico' ? 'Productos Críticos a Contar' : 'Ingrese el Stock Contado de Cada Producto'} *
                      </h4>
                      <p className="text-xs text-yellow-800 mb-3">
                        {modoCierre === 'critico' 
                          ? `Cuenta solo ${productosParaCierre.length} productos críticos. El resto usará el stock del sistema.`
                          : 'Cuente físicamente cada producto y escriba la cantidad en la columna "Stock Contado"'
                        }
                      </p>
                      
                      <div>
                        {/* VERSIÓN DESKTOP - Tabla */}
                        <div className="hidden md:block overflow-x-auto max-h-96 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-yellow-100 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 text-left font-semibold text-yellow-900">Código</th>
                                <th className="px-4 py-2 text-left font-semibold text-yellow-900">Producto</th>
                                <th className="px-4 py-2 text-center font-semibold text-yellow-900">Stock Esperado</th>
                                <th className="px-4 py-2 text-center font-semibold text-yellow-900">Unidad</th>
                                <th className="px-4 py-2 text-center font-semibold text-yellow-900">Stock Contado *</th>
                                <th className="px-4 py-2 text-center font-semibold text-yellow-900">Diferencia</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {(modoCierre === 'completo' ? allProductos : productosParaCierre).map((producto) => {
                                const stockContado = parseFloat(stockContadoPorProducto[producto.producto_id]) || 0;
                                const diferencia = stockContado - parseFloat(producto.stock_actual || 0);
                                const unidad = producto.unidad_peso || 'und';
                                return (
                                  <tr key={producto.producto_id} className="border-b border-yellow-200 hover:bg-yellow-50">
                                    <td className="px-4 py-2 font-semibold text-gray-900">{producto.codigo}</td>
                                    <td className="px-4 py-2 text-gray-900">{producto.producto}</td>
                                    <td className="px-4 py-2 text-center text-gray-700">
                                      {Math.round(parseFloat(producto.stock_actual || 0))}
                                    </td>
                                    <td className="px-4 py-2 text-center font-semibold text-gray-700">
                                      {unidad}
                                    </td>
                                    <td className="px-4 py-2">
                                      <input
                                        type="number"
                                        value={stockContadoPorProducto[producto.producto_id] || ''}
                                        onChange={(e) => setStockContadoPorProducto({
                                          ...stockContadoPorProducto,
                                          [producto.producto_id]: e.target.value
                                        })}
                                        placeholder="0"
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-yellow-500"
                                      />
                                    </td>
                                    <td className={`px-4 py-2 text-center font-semibold ${
                                      diferencia > 0 ? 'text-green-600' : diferencia < 0 ? 'text-red-600' : 'text-gray-600'
                                    }`}>
                                      {diferencia > 0 ? '+' : ''}{diferencia}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* VERSIÓN MÓVIL - Tarjetas simplificadas */}
                        <div className="block md:hidden max-h-96 overflow-y-auto space-y-3">
                          {(modoCierre === 'completo' ? allProductos : productosParaCierre).map((producto) => {
                            const stockContado = parseFloat(stockContadoPorProducto[producto.producto_id]) || 0;
                            const diferencia = stockContado - parseFloat(producto.stock_actual || 0);
                            const unidad = producto.unidad_peso || 'und';

                            return (
                              <div key={producto.producto_id} className="bg-white border-2 border-yellow-200 rounded-lg p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <span className="text-xs font-bold text-yellow-900 bg-yellow-100 px-2 py-1 rounded">{producto.codigo}</span>
                                    <h4 className="text-sm font-bold text-gray-900 mt-1">{producto.producto}</h4>
                                  </div>
                                  <div className="text-right text-xs text-gray-600">
                                    <div>Esperado: <span className="font-bold">{Math.round(parseFloat(producto.stock_actual || 0))} {unidad}</span></div>
                                  </div>
                                </div>

                                <input
                                  type="number"
                                  value={stockContadoPorProducto[producto.producto_id] || ''}
                                  onChange={(e) => setStockContadoPorProducto({
                                    ...stockContadoPorProducto,
                                    [producto.producto_id]: e.target.value
                                  })}
                                  placeholder="Stock contado"
                                  className="w-full px-4 py-2 text-lg border-2 border-yellow-300 rounded-lg text-center focus:ring-2 focus:ring-yellow-500 mb-2"
                                />

                                <div className={`text-center py-1 rounded font-bold text-sm ${
                                  diferencia > 0 ? 'bg-green-100 text-green-700' : 
                                  diferencia < 0 ? 'bg-red-100 text-red-700' : 
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  Diferencia: {diferencia > 0 ? '+' : ''}{diferencia} {unidad}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {modoCierre === 'rapido' && (
                    <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                      <p className="text-sm text-blue-900">
                        ℹ️ <strong>Cierre Rápido:</strong> El inventario se guardará con el stock actual del sistema. Ideal para cierres diarios sin diferencias significativas.
                      </p>
                    </div>
                  )}

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
                        Resumen del Cierre
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                          <h4 className="text-center font-bold text-gray-700 mb-4 text-lg">
                            💻 SISTEMA (Esperado)
                          </h4>
                          <div className="space-y-3">
                            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                              <p className="text-sm text-gray-600 mb-1">Caja Esperada</p>
                              <p className="text-xl font-bold text-gray-900">
                                {formatCurrency(cierreData.cajaEsperada)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-center font-bold text-gray-700 mb-4 text-lg">
                            ✋ CONTEO MANUAL
                          </h4>
                          <div className="space-y-3">
                            <div className={`rounded-lg p-4 border-2 ${
                              cierreData.cajaEsperada === parseFloat(cajaContada)
                                ? 'bg-green-50 border-green-500'
                                : 'bg-red-50 border-red-500'
                            }`}>
                              <p className="text-sm text-gray-600 mb-1">Caja Contada</p>
                              <p className="text-xl font-bold text-gray-900">
                                {formatCurrency(parseFloat(cajaContada))}
                              </p>
                              {cierreData.cajaEsperada !== parseFloat(cajaContada) && (
                                <p className="text-sm font-bold text-red-600 mt-2">
                                  Diferencia: {formatCurrency(Math.abs(cierreData.cajaEsperada - parseFloat(cajaContada)))}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status Final */}
                      <div className={`rounded-lg p-4 text-center ${
                        cierreData.cajaEsperada === parseFloat(cajaContada)
                          ? 'bg-green-100 border-2 border-green-500'
                          : 'bg-red-100 border-2 border-red-500'
                      }`}>
                        {cierreData.cajaEsperada === parseFloat(cajaContada) ? (
                          <>
                            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-green-800">✅ CUADRADO</p>
                            <p className="text-sm text-green-700 mt-1">La caja está perfectamente balanceada</p>
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

        {/* MODAL: MODIFICAR BASE */}
        {showBaseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
              <div className="bg-emerald-600 text-white p-6 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-6 h-6" />
                    <h2 className="text-xl font-bold">Modificar Base Inicial</h2>
                  </div>
                  <button 
                    onClick={() => setShowBaseModal(false)}
                    className="text-white hover:bg-emerald-700 p-2 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Importante:</strong> Esta base se usará para calcular la caja esperada en el próximo cierre.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Base Actual
                  </label>
                  <div className="bg-gray-100 rounded-lg p-4">
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(baseActual)}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Nueva Base *
                  </label>
                  <input
                    type="number"
                    value={baseActual}
                    onChange={(e) => setBaseActual(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg"
                    placeholder="Ejemplo: 50000"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowBaseModal(false)}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGuardarBase}
                    className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold"
                  >
                    Guardar Base
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: MODIFICAR INVENTARIO */}
        {showInventarioModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-blue-600 text-white p-6 rounded-t-lg sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="w-6 h-6" />
                    <h2 className="text-xl font-bold">Modificar Inventario</h2>
                  </div>
                  <button 
                    onClick={() => setShowInventarioModal(false)}
                    className="text-white hover:bg-blue-700 p-2 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    💡 Ajusta el stock actual de tus productos. Estos cambios se reflejarán inmediatamente.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-blue-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-blue-900">Código</th>
                        <th className="px-4 py-3 text-left font-semibold text-blue-900">Producto</th>
                        <th className="px-4 py-3 text-center font-semibold text-blue-900">Stock Actual</th>
                        <th className="px-4 py-3 text-center font-semibold text-blue-900">Nuevo Stock</th>
                        <th className="px-4 py-3 text-center font-semibold text-blue-900">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {allProductos.map((producto) => {
                        const nuevoStock = parseFloat(nuevoInventario[producto.producto_id]) || parseFloat(producto.stock_actual);
                        const diferencia = nuevoStock - parseFloat(producto.stock_actual || 0);

                        return (
                          <tr key={producto.producto_id} className="border-b hover:bg-blue-50">
                            <td className="px-4 py-3 font-semibold text-gray-900">{producto.codigo}</td>
                            <td className="px-4 py-3 text-gray-900">{producto.producto}</td>
                            <td className="px-4 py-3 text-center font-bold text-gray-700">
                              {Math.round(parseFloat(producto.stock_actual || 0))}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={nuevoInventario[producto.producto_id] || ''}
                                onChange={(e) => setNuevoInventario({
                                  ...nuevoInventario,
                                  [producto.producto_id]: e.target.value
                                })}
                                placeholder={Math.round(producto.stock_actual)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className={`px-4 py-3 text-center font-semibold ${
                              diferencia > 0 ? 'text-green-600' : diferencia < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {diferencia > 0 ? '+' : ''}{Math.round(diferencia)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3 pt-4 mt-4 border-t">
                  <button
                    onClick={() => setShowInventarioModal(false)}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGuardarInventario}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: MODIFICAR APODOS */}
        {showApodosModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-purple-600 text-white p-6 rounded-t-lg sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Edit2 className="w-6 h-6" />
                    <h2 className="text-xl font-bold">Modificar Apodos</h2>
                  </div>
                  <button 
                    onClick={() => setShowApodosModal(false)}
                    className="text-white hover:bg-purple-700 p-2 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-purple-800">
                    🏷️ Los apodos permiten buscar productos con nombres alternativos (ej: "coca" para "Coca Cola"). Separa múltiples apodos con comas.
                  </p>
                </div>

                <div className="space-y-3">
                  {allProductos.map((producto) => (
                    <div key={producto.producto_id} className="border rounded-lg p-4 hover:bg-purple-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-gray-900">{producto.producto}</p>
                          <p className="text-xs text-gray-500">Código: {producto.codigo}</p>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Ej: coca, gaseosa negra, coca cola"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                        defaultValue={producto.apodos || ''}
                        onChange={(e) => setApodosProductos({
                          ...apodosProductos,
                          [producto.producto_id]: e.target.value
                        })}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-4 mt-4 border-t">
                  <button
                    onClick={() => setShowApodosModal(false)}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGuardarApodos}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-bold"
                  >
                    Guardar Apodos
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: VER CONCEPTOS DE GASTOS */}
        {showConceptosModal && categoriaSeleccionada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="bg-amber-600 text-white p-6 rounded-t-lg sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6" />
                    <div>
                      <h2 className="text-xl font-bold">Conceptos de Gastos</h2>
                      <p className="text-sm text-amber-100 mt-1">Categoría: {categoriaSeleccionada}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowConceptosModal(false);
                      setCategoriaSeleccionada(null);
                    }}
                    className="text-white hover:bg-amber-700 p-2 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Lista de conceptos */}
                <div className="space-y-3">
                  {gastosDelPeriodo
                    .filter(gasto => (gasto.categoria || 'Sin categoría') === categoriaSeleccionada)
                    .map((gasto, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-amber-50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 mb-1">
                              {gasto.concepto || 'Sin concepto'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(gasto.created_at).toLocaleString('es-CO', { 
                                timeZone: 'America/Bogota',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(gasto.monto)}
                            </p>
                          </div>
                        </div>
                        {gasto.descripcion && (
                          <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-200">
                            📝 {gasto.descripcion}
                          </p>
                        )}
                      </div>
                    ))}
                </div>

                {/* Total de la categoría */}
                <div className="mt-6 pt-4 border-t-2 border-gray-300">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-gray-800">Total {categoriaSeleccionada}:</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {formatCurrency(gastosPorCategoria[categoriaSeleccionada])}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {gastosDelPeriodo.filter(g => (g.categoria || 'Sin categoría') === categoriaSeleccionada).length} gasto(s) registrado(s)
                  </p>
                </div>

                {/* Botón cerrar */}
                <div className="mt-6">
                  <button
                    onClick={() => {
                      setShowConceptosModal(false);
                      setCategoriaSeleccionada(null);
                    }}
                    className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-bold"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Dashboard generado automáticamente • PosWhatsApp © 2025</p>
          <p className="mt-1 text-xs">Generado: {new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;