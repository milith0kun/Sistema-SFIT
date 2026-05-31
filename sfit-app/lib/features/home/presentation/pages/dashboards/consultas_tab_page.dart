import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_theme.dart';

/// Pestaña del Ciudadano que agrupa todas las herramientas de consulta y seguimiento.
///
/// Ofrece una barra de búsqueda simulada prominente y un grid interactivo
/// con micro-animaciones táctiles para una experiencia móvil premium.
class ConsultasTabPage extends StatelessWidget {
  final Function(String) onSelectTab;

  const ConsultasTabPage({super.key, required this.onSelectTab});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.paper,
      child: SafeArea(
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Cabecera descriptiva
              Text(
                'CONSULTAS Y HERRAMIENTAS',
                style: AppTheme.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink5,
                  letterSpacing: 1.6,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Consulta información vehicular y monitorea tu viaje en tiempo real.',
                style: AppTheme.inter(
                  fontSize: 14,
                  color: AppColors.ink6,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),

              // Buscador de vehículos simulado prominente
              GestureDetector(
                onTap: () => context.push('/buscar-vehiculo'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.ink2),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.search_rounded, color: AppColors.ink5, size: 22),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Ingresa la placa del vehículo (Ej. B0Z-816)...',
                          style: AppTheme.inter(
                            fontSize: 14,
                            color: AppColors.ink5,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.panel.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'BUSCAR',
                          style: AppTheme.inter(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.panel,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Grid de tarjetas de herramientas
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                crossAxisSpacing: 14,
                mainAxisSpacing: 14,
                childAspectRatio: 1.15,
                children: [
                  _ToolCard(
                    icon: Icons.qr_code_scanner_outlined,
                    title: 'Escanear QR',
                    subtitle: 'Verifica la habilitación oficial al subir a un vehículo.',
                    accentColor: AppColors.primary,
                    onTap: () => context.push('/qr'),
                  ),
                  _ToolCard(
                    icon: Icons.directions_bus_outlined,
                    title: 'Buses en vivo',
                    subtitle: 'Mapa en tiempo real del transporte público urbano.',
                    accentColor: AppColors.info,
                    onTap: () => context.push('/buses-en-vivo'),
                  ),
                  _ToolCard(
                    icon: Icons.airport_shuttle_outlined,
                    title: 'Viaje Interprov.',
                    subtitle: 'Registra y sigue tu viaje con alertas de velocidad.',
                    accentColor: AppColors.apto,
                    onTap: () => context.push('/ciudadano/mi-viaje'),
                  ),
                  _ToolCard(
                    icon: Icons.search_rounded,
                    title: 'Búsqueda Manual',
                    subtitle: 'Ingresa la placa para auditar su estado e historial.',
                    accentColor: AppColors.goldDark,
                    onTap: () => context.push('/buscar-vehiculo'),
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tarjeta del grid de herramientas con micro-animaciones interactivas.
class _ToolCard extends StatefulWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color accentColor;
  final VoidCallback onTap;

  const _ToolCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accentColor,
    required this.onTap,
  });

  @override
  State<_ToolCard> createState() => _ToolCardState();
}

class _ToolCardState extends State<_ToolCard> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 100),
      vsync: this,
    );
    _scale = Tween<double>(begin: 1.0, end: 0.95).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) {
        _controller.reverse();
        widget.onTap();
      },
      onTapCancel: () => _controller.reverse(),
      child: ScaleTransition(
        scale: _scale,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.ink2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: widget.accentColor.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  widget.icon,
                  color: widget.accentColor,
                  size: 22,
                ),
              ),
              const Spacer(),
              Text(
                widget.title,
                style: AppTheme.inter(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 4),
              Expanded(
                child: Text(
                  widget.subtitle,
                  style: AppTheme.inter(
                    fontSize: 11,
                    color: AppColors.ink5,
                    height: 1.3,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
