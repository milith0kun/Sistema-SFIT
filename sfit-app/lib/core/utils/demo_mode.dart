/// Modo demo — actívalo compilando con:
///   flutter run --dart-define=SFIT_DEMO=true
///
/// Cuando [kDemoMode] es true, las páginas que lo soporten usarán datos
/// mock locales de [mock_data.dart] en lugar de llamar a la API real.
/// Útil para presentaciones y pruebas sin conexión al backend.
const bool kDemoMode =
    bool.fromEnvironment('SFIT_DEMO', defaultValue: false);
