import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Si falta google-services.json en el build, no bloquear el arranque
  }
  runApp(
    const ProviderScope(
      child: SfitApp(),
    ),
  );
}
