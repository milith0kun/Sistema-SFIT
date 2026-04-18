// Basic smoke test. La app real (SfitApp) requiere ProviderScope, red y
// secure storage, por lo que aquí solo validamos un boot mínimo.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Smoke test: MaterialApp boots', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: Center(child: Text('SFIT')))),
    );
    expect(find.text('SFIT'), findsOneWidget);
  });
}
