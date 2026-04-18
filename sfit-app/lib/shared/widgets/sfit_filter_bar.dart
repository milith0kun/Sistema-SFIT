import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Spec de un dropdown del filter bar.
class SfitFilterSelect {
  final String label;
  final String? value;
  final List<SfitFilterOption> options;
  final ValueChanged<String?> onChanged;

  const SfitFilterSelect({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });
}

class SfitFilterOption {
  final String value;
  final String label;
  const SfitFilterOption({required this.value, required this.label});
}

/// Barra de filtros canónica: search + dropdowns + action primary opcional.
///
/// Para mantenerla usable en móvil, el layout es vertical con wrap:
///  - Row 1: search (ancho completo)
///  - Row 2: dropdowns en Wrap + primary trailing
class SfitFilterBar extends StatelessWidget {
  final TextEditingController searchController;
  final String? searchHint;
  final ValueChanged<String>? onSearchChanged;
  final List<SfitFilterSelect>? selects;
  final Widget? primary;

  const SfitFilterBar({
    super.key,
    required this.searchController,
    this.searchHint,
    this.onSearchChanged,
    this.selects,
    this.primary,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: searchController,
          onChanged: onSearchChanged,
          decoration: InputDecoration(
            hintText: searchHint ?? 'Buscar…',
            prefixIcon: const Icon(Icons.search_rounded,
                size: 20, color: AppColors.ink5),
            isDense: true,
          ),
          style: AppTheme.inter(fontSize: 14, color: AppColors.ink9),
        ),
        if ((selects != null && selects!.isNotEmpty) || primary != null) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (selects != null)
                ...selects!.map((s) => _buildSelect(s)),
              if (primary != null) primary!,
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildSelect(SfitFilterSelect s) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2, width: 1.5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: s.value,
          hint: Text(
            s.label,
            style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
          ),
          icon: const Icon(Icons.expand_more_rounded,
              size: 18, color: AppColors.ink5),
          style: AppTheme.inter(fontSize: 13, color: AppColors.ink9),
          items: s.options
              .map((o) => DropdownMenuItem<String>(
                    value: o.value,
                    child: Text(o.label),
                  ))
              .toList(),
          onChanged: s.onChanged,
        ),
      ),
    );
  }
}
