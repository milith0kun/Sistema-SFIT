# SFIT App — Flutter 3.29 / Dart 3.7

## Stack

Flutter 3.29 · Dart 3.7 · Riverpod 2 (annotations) · GoRouter 15 · Dio + Retrofit · Freezed · Firebase Messaging

## Estructura

```
lib/
├── main.dart                       → ProviderScope + runApp
├── app.dart                        → MaterialApp.router (usa routerProvider)
├── core/
│   ├── constants/                  → ApiConstants, AppConstants
│   ├── network/dio_client.dart     → Dio + AuthInterceptor + RefreshInterceptor
│   ├── router/app_router.dart      → GoRouter como @riverpod provider con auth guard
│   ├── theme/                      → AppColors, AppTheme
│   └── utils/                      → formatters, validators
├── features/[feature]/
│   ├── data/
│   │   ├── models/                 → @freezed + @JsonSerializable
│   │   ├── datasources/            → Retrofit API services + local datasources
│   │   └── repositories/          → implementación concreta
│   ├── domain/
│   │   ├── entities/               → entidades puras
│   │   └── repositories/          → interfaz abstracta
│   └── presentation/
│       ├── providers/              → @riverpod AsyncNotifier/Notifier
│       ├── pages/                  → una página por archivo
│       └── widgets/                → widgets de la feature
└── shared/
    ├── widgets/                    → widgets reutilizables globales
    └── providers/                  → authProvider, configProvider
```

## Riverpod 2

- `@riverpod` annotation siempre — nunca `Provider(...)` manual.
- `AsyncNotifier` para estado mutable asíncrono; `Notifier` para síncrono.
- `FutureProvider` solo para datos de lectura inmutables.
- `ref.invalidateSelf()` para refrescar después de mutaciones.
- No poner lógica de negocio en widgets.

## GoRouter

- El router es un `@Riverpod(keepAlive: true)` provider que observa `authProvider`.
- `redirect` maneja la guarda de autenticación — nunca `if` en `initState`.
- Navegar con `context.go()`, nunca `Navigator.push`.
- `ShellRoute` para layout con bottom nav.

## Modelos (Freezed)

```dart
@freezed
class MiModelo with _$MiModelo {
  const factory MiModelo({ required String id }) = _MiModelo;
  factory MiModelo.fromJson(Map<String, dynamic> json) => _$MiModeloFromJson(json);
}
```

- `_id` de MongoDB → `@JsonKey(name: '_id') String id`.
- Ejecutar `flutter pub run build_runner build --delete-conflicting-outputs` tras cambios.

## UI / Widgets

- Material 3 — `Theme.of(context).colorScheme` y `textTheme`, nunca colores hardcoded.
- `const` en todos los widgets que no cambian.
- `AsyncValue.when(data:, loading:, error:)` para estados asíncronos.
- Responsive con `LayoutBuilder` o `MediaQuery`.

## Offline / QR

- Validación QR sin conexión usando HMAC-SHA256 local (crypto package).
- Datos de inspección en Hive para sincronización posterior.
