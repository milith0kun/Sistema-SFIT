# sfit_app

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.

## Configuracion QR HMAC (importante)

Para que la verificacion offline del QR coincida con el backend web, ejecuta
la app movil con el mismo secreto que usa `QR_HMAC_SECRET` en `sfit-web`.

Ejemplo:

```bash
flutter run --dart-define=SFIT_QR_SECRET="<mismo_valor_de_QR_HMAC_SECRET>"
```

Si no defines ese valor, se usa el fallback `SFIT_QR_SECRET_KEY`.
