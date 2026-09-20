import 'package:flutter/material.dart';

import '../core/app_colors.dart';

class StressLevelCard extends StatelessWidget {
  const StressLevelCard({
    super.key,
    required this.value,
    required this.label,
    required this.onChanged,
  });

  final double value;
  final String label;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(25, 25, 25, 22),
      decoration: BoxDecoration(
        color: AppColors.cream,
        borderRadius: BorderRadius.circular(50),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D7B6500),
            blurRadius: 14,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Mức độ hiện tại',
                  style: TextStyle(fontSize: 25, fontWeight: FontWeight.w800),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 15,
                  vertical: 9,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFD921),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 15,
                    color: Color(0xFF695B1D),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 38),
          LayoutBuilder(
            builder: (context, constraints) => GestureDetector(
              onHorizontalDragUpdate: (details) => onChanged(
                (details.localPosition.dx / constraints.maxWidth).clamp(0, 1),
              ),
              onTapDown: (details) => onChanged(
                (details.localPosition.dx / constraints.maxWidth).clamp(0, 1),
              ),
              child: SizedBox(
                height: 38,
                child: Stack(
                  alignment: Alignment.centerLeft,
                  children: [
                    Container(
                      height: 28,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(30),
                        gradient: const LinearGradient(
                          colors: [
                            Color(0xFF75E98C),
                            Color(0xFFF6E733),
                            Color(0xFFFF8E93),
                            Color(0xFFC85B89),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      left: (constraints.maxWidth - 38) * value,
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.burgundy,
                            width: 5,
                          ),
                        ),
                        child: const Icon(
                          Icons.drag_indicator_rounded,
                          size: 17,
                          color: AppColors.burgundy,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 3),
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('😊', style: TextStyle(fontSize: 24)),
              Text('😐', style: TextStyle(fontSize: 24)),
              Text('😵', style: TextStyle(fontSize: 24)),
            ],
          ),
        ],
      ),
    );
  }
}
