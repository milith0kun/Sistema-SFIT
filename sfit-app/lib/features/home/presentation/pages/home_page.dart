import 'package:flutter/material.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SFIT'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {
              // TODO: Navegación a notificaciones
            },
          ),
          IconButton(
            icon: const Icon(Icons.person_outlined),
            onPressed: () {
              // TODO: Navegación a perfil
            },
          ),
        ],
      ),
      body: const Center(
        child: Text(
          'SFIT — Home\n\nEl contenido se adaptará según el rol del usuario.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
