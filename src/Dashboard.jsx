import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  DollarSign, 
  ShoppingCart, 
  ShoppingBag, 
  TrendingUp, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle, 
  Package,
  User,
  Store,
  Clock,
  CreditCard,
  Receipt,
  Wallet
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [tenantInfo, setTenantInfo] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [reportDate, setReportDate] = useState(new Date());

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

      // Validar token en Supabase
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

      // Verificar si el token no ha expirado
      const now = new Date();
      const expiresAt = new Date(tokenData.expires_at);
      
      if (now > expiresAt || tokenData.usos >= 1) {
        setIsValidToken(false);
        setLoading(false);
        return;
      }

      // Actualizar uso del token
      await supabase
        .from('form_tokens')
        .update({ 
          usos: tokenData.usos + 1,
          ultimo_uso_at: new Date().toISOString()
        })
        .eq('token', urlToken);

      setIsValidToken(true);
      setTenantId(tokenData.tenant_id);

      // Cargar información del tenant y usuario
      await loadTenantAndUserInfo(tokenData.tenant_id, tokenData.user_id);

      // Cargar datos del dashboard
      await loadDashboardData(tokenData.tenant_id);
    };

    initDashboard();
  }, []);

  const loadTenantAndUserInfo = async (tenant_id, user_id) => {
    try {
      // Cargar información del tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('nombre_negocio')
        .eq('tenant_id', tenant_id)
        .single();

      if (tenantError) throw tenantError;
      setTenantInfo(tenant);

      // Cargar información del usuario
      const { data: user, error: userError } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('usuario_id', user_id)
        .single();

      if (userError) throw userError;
      setUserInfo(user);

      // Establecer fecha y hora de generación del reporte
      setReportDate(new Date());

    } catch (error) {
      console.error('Error cargando información del tenant/usuario:', error);
    }
  };

  const loadDashboardData = async (tenant_id, fechaInicioToken = null, fechaFinToken = null) => {
    try {
      console.log('🔍 Cargando datos para tenant_id:', tenant_id);
      
      let startDate, endDate;
      
      if (fechaInicioToken && fechaFinToken) {
        startDate = `${fechaInicioToken} 00:00:00`;
        endDate = `${fechaFinToken} 23:59:59`;
        console.log('📅 Usando fechas del token:', { startDate, endDate });
      } else {
        const dateRangeResult = getDateRange(dateRange);
        startDate = dateRangeResult.startDate;
        endDate = dateRangeResult.endDate;
        console.log('📅 Usando rango seleccionado:', { startDate, endDate });
      }
  
      // 1. Obtener ventas
      const { data: ventas, error: ventasError } = await supabase
        .from('ventas')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('activo', true)
        .is('deleted_at', null);

      console.log('💰 Ventas obtenidas:', ventas, 'Error:', ventasError);

      if (ventasError) throw ventasError;

      // 2. Obtener compras (entradas)
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

      // 3. Obtener consumos
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

      // 4. Obtener gastos
      const { data: gastos, error: gastosError } = await supabase
        .from('gastos')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('activo', true)
        .is('deleted_at', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (gastosError) throw gastosError;

      // 5. Obtener productos
      const { data: productos, error: productosError } = await supabase
        .from('productos')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('activo', true)
        .is('deleted_at', null);

      if (productosError) throw productosError;

      // Procesar datos
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
    // Calcular totales
    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    const totalCompras = compras.reduce((sum, c) => sum + parseFloat(c.costo_total || 0), 0);
    const totalConsumos = consumos.reduce((sum, c) => sum + parseFloat(c.costo_total || 0), 0);
    const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
    
    // Utilidad Real = Ventas - Compras - Consumo Personal - Gastos
    const utilidadReal = totalVentas - totalCompras - totalConsumos - totalGastos;

    // Procesar productos más vendidos con rotación
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
              rotacion: 0, // Número de veces vendido
              costo: parseFloat(item.COSTO || 0)
            };
          }
          productosVendidos[productoNombre].cantidad += parseFloat(item.CANTIDAD || 0);
          productosVendidos[productoNombre].total += parseFloat(item.VALOR_TOTAL || 0);
          productosVendidos[productoNombre].rotacion += 1; // Incrementar por cada venta
        });
      }
    });

    // Top 5 productos
    const topProductos = Object.values(productosVendidos)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((prod, index) => {
        const productoInfo = productos.find(p => p.producto === prod.nombre);
        
        // Calcular margen usando columna costo de la tabla productos
        const costo = parseFloat(productoInfo?.costo || prod.costo || 0);
        const precioVenta = parseFloat(productoInfo?.precio_venta || 0);
        const margen = precioVenta > 0 ? 
          Math.round(((precioVenta - costo) / precioVenta) * 100) : 0;

        return {
          codigo: productoInfo?.codigo || `P${String(index + 1).padStart(3, '0')}`,
          nombre: prod.nombre,
          vendidos: Math.round(prod.cantidad * 100) / 100,
          total: prod.total,
          stock: parseFloat(productoInfo?.stock_actual || 0),
          margen: margen,
          rotacion: prod.rotacion,
          unidadMedida: productoInfo?.tipo_peso || 'und',
          promedioSemanal: prod.rotacion / 1 // Aproximación para rotación semanal
        };
      });

    // Productos para gráfico de pastel
    const productosChart = topProductos.map(p => ({
      nombre: p.nombre.length > 15 ? p.nombre.substring(0, 15) + '...' : p.nombre,
      valor: p.total,
      porcentaje: Math.round((p.total / totalVentas) * 100)
    }));

    // Alertas de stock bajo con cálculo dinámico basado en rotación
    const alertasStockBajo = productos
      .filter(p => {
        const stockActual = parseFloat(p.stock_actual);
        const productoVendido = productosVendidos[p.producto];
        
        if (!productoVendido) return false;
        
        // Calcular promedio diario de ventas
        const ventasSemanales = productoVendido.rotacion;
        const promedioDiario = ventasSemanales / 7;
        
        // Si alta rotación (>5 ventas/semana): alerta si stock < (promedio_diario × 3)
        // Si baja rotación (<5 ventas/semana): alerta si stock < (promedio_diario × 1)
        const umbral = ventasSemanales > 5 ? promedioDiario * 3 : promedioDiario * 1;
        
        return stockActual < umbral && stockActual > 0;
      })
      .slice(0, 5)
      .map(p => {
        const productoVendido = productosVendidos[p.producto];
        const rotacion = productoVendido?.rotacion || 0;
        const unidad = p.tipo_peso || 'und';
        return `${p.producto} (${Math.round(p.stock_actual)} ${unidad}) - Rotación: ${rotacion}/sem`;
      });

    // Productos sin movimiento (sin ventas en el período)
    const productosSinMovimiento = productos
      .filter(p => !productosVendidos[p.producto])
      .slice(0, 5)
      .map(p => p.producto);

    // Producto más rentable
    const masRentable = topProductos.length > 0 ? 
      topProductos.reduce((max, p) => p.margen > max.margen ? p : max, topProductos[0]) : null;

    // Ventas por día (últimos 7 días)
    const ventasPorDia = getVentasPorDia(ventas, compras, gastos);

    // Tendencia acumulada
    const tendencia = getTendenciaAcumulada(ventas);

    // Últimos movimientos
    const ultimosMovimientos = getUltimosMovimientos(ventas, compras, consumos, productos);

    // KPIs
    const ticketPromedio = ventas.length > 0 ? totalVentas / ventas.length : 0;
    const productoMayorRotacion = topProductos.length > 0 ? topProductos[0].nombre : 'N/A';

    return {
      resumen: {
        ventas: totalVentas,
        compras: totalCompras,
        consumos: totalConsumos,
        gastos: totalGastos,
        utilidadReal: utilidadReal
      },
      ventasSemanales: ventasPorDia,
      topProductos: topProductos,
      productosChart: productosChart,
      tendencia: tendencia,
      movimientos: ultimosMovimientos,
      alertas: {
        stockBajo: alertasStockBajo,
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

    // Inicializar últimos 7 días
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      const dia = dias[fecha.getDay()];
      ventasPorDia[dia] = { dia, ventas: 0, compras: 0, gastos: 0 };
    }

    // Agregar ventas
    ventas.forEach(v => {
      const fecha = new Date(v.created_at);
      const dia = dias[fecha.getDay()];
      if (ventasPorDia[dia]) {
        ventasPorDia[dia].ventas += parseFloat(v.total || 0);
      }
    });

    // Agregar compras
    compras.forEach(c => {
      const fecha = new Date(c.created_at);
      const dia = dias[fecha.getDay()];
      if (ventasPorDia[dia]) {
        ventasPorDia[dia].compras += parseFloat(c.costo_total || 0);
      }
    });

    // Agregar gastos
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

    // Inicializar últimos 7 días
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      const dia = dias[fecha.getDay()];
      ventasPorDia[dia] = 0;
    }

    // Sumar ventas por día
    ventas.forEach(v => {
      const fecha = new Date(v.created_at);
      const dia = dias[fecha.getDay()];
      if (ventasPorDia.hasOwnProperty(dia)) {
        ventasPorDia[dia] += parseFloat(v.total || 0);
      }
    });

    // Crear tendencia acumulada
    return Object.entries(ventasPorDia).map(([dia, monto]) => {
      acumulado += monto;
      return { dia, acumulado: Math.round(acumulado) };
    });
  };

  const getUltimosMovimientos = (ventas, compras, consumos, productos) => {
    const movimientos = [];

    // Agregar ventas
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

    // Agregar compras
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

    // Agregar consumos
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

    // Ordenar por fecha más reciente
    return movimientos
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 10);
  };

  const handleExportPDF = () => {
    if (!dashboardData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Encabezado
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Informe de Dashboard - Tienda de Barrio', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    // Información del negocio y usuario
    let yPosition = 25;
    doc.text(`Negocio: ${tenantInfo?.nombre_negocio || 'N/A'}`, 14, yPosition);
    yPosition += 6;
    doc.text(`Propietario: ${userInfo?.nombre || 'N/A'}`, 14, yPosition);
    yPosition += 6;
    doc.text(`Fecha de generación: ${reportDate.toLocaleDateString('es-CO')} ${reportDate.toLocaleTimeString('es-CO')}`, 14, yPosition);
    yPosition += 10;

    // Resumen Financiero
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen Financiero', 14, yPosition);
    yPosition += 8;

    autoTable(doc, {
      startY: yPosition,
      head: [['Concepto', 'Valor']],
      body: [
        ['Total Ventas', formatCurrency(dashboardData.resumen.ventas)],
        ['Total Compras', formatCurrency(dashboardData.resumen.compras)],
        ['Consumo Personal', formatCurrency(dashboardData.resumen.consumos)],
        ['Gastos Operacionales', formatCurrency(dashboardData.resumen.gastos)],
        ['Utilidad Real', formatCurrency(dashboardData.resumen.utilidadReal)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 10 }
    });

    yPosition = doc.lastAutoTable.finalY + 10;

    // Top Productos
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Top Productos', 14, yPosition);
    yPosition += 8;

    autoTable(doc, {
      startY: yPosition,
      head: [['Código', 'Producto', 'Vendidos', 'Total', 'Stock', 'Margen', 'Rotación']],
      body: dashboardData.topProductos.map(p => [
        p.codigo,
        p.nombre,
        `${p.vendidos} ${p.unidadMedida}`,
        formatCurrency(p.total),
        `${Math.round(p.stock)} ${p.unidadMedida}`,
        `${p.margen}%`,
        `${p.rotacion}/sem`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 9 }
    });

    yPosition = doc.lastAutoTable.finalY + 10;

    // Alertas
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Alertas de Stock', 14, yPosition);
    yPosition += 8;

    const alertasBody = dashboardData.alertas.stockBajo.length > 0 
      ? dashboardData.alertas.stockBajo.map(alert => [alert])
      : [['No hay alertas de stock bajo']];

      autoTable(doc, {
      startY: yPosition,
      head: [['Producto']],
      body: alertasBody,
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68] },
      styles: { fontSize: 9 }
    });

    // Guardar PDF
    doc.save(`Dashboard-${tenantInfo?.nombre_negocio || 'Reporte'}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Recargar datos cuando cambia el rango de fechas
  useEffect(() => {
    if (tenantId && !customDates) {
      setLoading(true);
      loadDashboardData(tenantId);
    }
  }, [dateRange]);

  // Ordenar productos según el criterio seleccionado
  const sortedProducts = dashboardData?.topProductos ? [...dashboardData.topProductos].sort((a, b) => {
    switch (sortBy) {
      case 'ventas':
        return b.total - a.total;
      case 'stock':
        return b.stock - a.stock;
      case 'margen':
        return b.margen - a.margen;
      case 'rotacion':
        return b.rotacion - a.rotacion;
      default:
        return 0;
    }
  }) : [];

  // Filtrar movimientos según el tipo seleccionado
  const filteredMovements = dashboardData?.movimientos ? 
    filterMovement === 'todos' 
      ? dashboardData.movimientos
      : dashboardData.movimientos.filter(m => m.tipo.toLowerCase() === filterMovement)
    : [];

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Token Inválido o Expirado</h2>
          <p className="text-gray-600 mb-6">
            El enlace que utilizaste no es válido o ya ha sido usado. Por favor, solicita un nuevo enlace.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-emerald-500 border-solid"></div>
          <p className="mt-4 text-gray-600 font-medium">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Sin Datos</h2>
          <p className="text-gray-600">No se encontraron datos para mostrar en este período.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* ENCABEZADO MEJORADO */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Store className="w-6 h-6" />
                <h1 className="text-2xl font-bold">{tenantInfo?.nombre_negocio || 'Mi Tienda'}</h1>
              </div>
              <div className="flex items-center gap-2 text-emerald-100">
                <User className="w-4 h-4" />
                <span className="text-sm">Propietario: {userInfo?.nombre || 'N/A'}</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 text-emerald-100">
                <Clock className="w-4 h-4" />
                <span className="text-sm">
                  {reportDate.toLocaleDateString('es-CO', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
              <span className="text-sm text-emerald-100">
                Generado: {reportDate.toLocaleTimeString('es-CO')}
              </span>
            </div>
          </div>
        </div>

        {/* Controles */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-full sm:w-auto"
            >
              <option value="today">Hoy</option>
              <option value="week">Última Semana</option>
              <option value="month">Este Mes</option>
            </select>

            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-md w-full sm:w-auto justify-center"
            >
              <Download className="w-5 h-5" />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* RESUMEN FINANCIERO MEJORADO - 5 CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          
          {/* Card 1: Ventas */}
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

          {/* Card 2: Compras */}
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

          {/* Card 3: Consumo Personal */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Consumo Personal</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.consumos)}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-full">
                <ShoppingBag className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Card 4: Gastos Operacionales */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Gastos Operacionales</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(dashboardData.resumen.gastos)}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <Receipt className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          {/* Card 5: Utilidad Real */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Utilidad Real</p>
                <p className={`text-2xl font-bold mt-1 ${dashboardData.resumen.utilidadReal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(dashboardData.resumen.utilidadReal)}
                </p>
              </div>
              <div className={`p-3 rounded-full ${dashboardData.resumen.utilidadReal >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <Wallet className={`w-6 h-6 ${dashboardData.resumen.utilidadReal >= 0 ? 'text-green-600' : 'text-red-600'}`} />
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

        {/* Gráfico de Línea de Tendencia */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Ventas Acumuladas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dashboardData.tendencia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="acumulado" stroke="#10b981" strokeWidth={3} name="Ventas Acumuladas" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* TABLA TOP PRODUCTOS MEJORADA */}
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
                <option value="rotacion">Ordenar por Rotación</option>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rotación</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedProducts.map((producto, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{producto.codigo}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{producto.nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {producto.vendidos} {producto.unidadMedida}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(producto.total)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          producto.stock < 10 ? 'bg-red-100 text-red-800' : 
                          producto.stock < 50 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-green-100 text-green-800'
                        }`}>
                          {Math.round(producto.stock)} {producto.unidadMedida}
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
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          producto.rotacion > 10 ? 'bg-green-100 text-green-800' : 
                          producto.rotacion > 5 ? 'bg-blue-100 text-blue-800' : 
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {producto.rotacion}/sem
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

        {/* ALERTAS MEJORADAS CON CÁLCULO DINÁMICO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h4 className="font-bold text-gray-800">Stock Bajo (por Rotación)</h4>
            </div>
            {dashboardData.alertas.stockBajo.length > 0 ? (
              <ul className="space-y-2">
                {dashboardData.alertas.stockBajo.map((item, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No hay productos con stock bajo</p>
            )}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                <strong>Nota:</strong> Cálculo basado en rotación semanal
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              <h4 className="font-bold text-gray-800">Sin Movimiento</h4>
            </div>
            {dashboardData.alertas.sinMovimiento.length > 0 ? (
              <ul className="space-y-2">
                {dashboardData.alertas.sinMovimiento.map((item, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Todos los productos tienen movimiento</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <h4 className="font-bold text-gray-800">Más Rentable</h4>
            </div>
            <p className="text-sm text-gray-700 mb-3">{dashboardData.alertas.masRentable}</p>
            {dashboardData.alertas.stockBajo.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-green-800 mb-1">💡 Sugerencia:</p>
                <p className="text-sm text-green-700">Reponer stock crítico</p>
              </div>
            )}
          </div>
        </div>

        {/* Indicadores Clave */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Indicadores Clave de Rendimiento</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4">
              <p className="text-sm text-emerald-700 font-medium mb-1">Ticket Promedio</p>
              <p className="text-2xl font-bold text-emerald-900">{formatCurrency(dashboardData.kpis.ticketPromedio)}</p>
            </div>
            
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
              <p className="text-2xl font-bold text-amber-900">{dashboardData.topProductos.length}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Dashboard generado automáticamente • PosWhatsApp © 2025</p>
          <p className="mt-1 text-xs">Token: {token.substring(0, 10) + '...'}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
