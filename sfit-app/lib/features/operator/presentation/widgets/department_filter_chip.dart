import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Selector horizontal de departamento (UBIGEO 2 dígitos) para filtrar
/// listados por área de cobertura. Visible solo cuando la empresa cubre
/// 2+ departamentos: con uno solo no aporta valor.
///
/// Las opciones se pasan como pares `code → label`. `selectedCode = null`
/// significa "todos los departamentos de mi empresa".
class DepartmentFilterChip extends StatelessWidget {
  final List<DepartmentOption> options;
  final String? selectedCode;
  final ValueChanged<String?> onChanged;

  const DepartmentFilterChip({
    super.key,
    required this.options,
    required this.selectedCode,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    if (options.length < 2) return const SizedBox.shrink();

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          _Chip(
            label: 'Todos',
            selected: selectedCode == null,
            onTap: () => onChanged(null),
          ),
          for (final o in options) ...[
            const SizedBox(width: 6),
            _Chip(
              label: o.label,
              selected: o.code == selectedCode,
              onTap: () => onChanged(o.code),
            ),
          ],
        ],
      ),
    );
  }
}

class DepartmentOption {
  final String code;
  final String label;
  const DepartmentOption({required this.code, required this.label});
}

class _Chip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primary.withValues(alpha: 0.12)
              : Colors.white,
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.ink2,
            width: selected ? 1.5 : 1,
          ),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: AppTheme.inter(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: selected ? AppColors.primary : AppColors.ink8,
          ),
        ),
      ),
    );
  }
}

/// Mapeo UBIGEO 2-dig → nombre de departamento. Sirve como fallback cuando el
/// backend no envía nombres y para construir las opciones del chip.
const Map<String, String> kPeruDepartments = <String, String>{
  '01': 'Amazonas',
  '02': 'Áncash',
  '03': 'Apurímac',
  '04': 'Arequipa',
  '05': 'Ayacucho',
  '06': 'Cajamarca',
  '07': 'Callao',
  '08': 'Cusco',
  '09': 'Huancavelica',
  '10': 'Huánuco',
  '11': 'Ica',
  '12': 'Junín',
  '13': 'La Libertad',
  '14': 'Lambayeque',
  '15': 'Lima',
  '16': 'Loreto',
  '17': 'Madre de Dios',
  '18': 'Moquegua',
  '19': 'Pasco',
  '20': 'Piura',
  '21': 'Puno',
  '22': 'San Martín',
  '23': 'Tacna',
  '24': 'Tumbes',
  '25': 'Ucayali',
};
