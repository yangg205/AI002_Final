import 'package:flutter/material.dart';

import '../core/app_colors.dart';

class AppBottomNavigation extends StatelessWidget {
  const AppBottomNavigation({super.key});

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.forum_outlined, 'Tâm sự'),
      (Icons.favorite_border_rounded, 'Đo Stress'),
      (Icons.psychology_outlined, 'Bài tập'),
      (Icons.error_outline_rounded, 'Cảnh báo'),
    ];

    return SafeArea(
      top: false,
      child: Container(
        height: 89,
        decoration: const BoxDecoration(
          color: AppColors.navigationBackground,
          boxShadow: [
            BoxShadow(
              color: Color(0x12000000),
              blurRadius: 12,
              offset: Offset(0, -3),
            ),
          ],
        ),
        child: Row(
          children: List.generate(items.length, (index) {
            final selected = index == 1;
            return Expanded(
              child: Stack(
                alignment: Alignment.center,
                children: [
                  if (selected)
                    Container(
                      width: 102,
                      height: 88,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFD92A),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(color: Color(0x33E4B900), blurRadius: 16),
                        ],
                      ),
                    ),
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        items[index].$1,
                        size: 30,
                        color: selected
                            ? AppColors.olive
                            : const Color(0xFF332F21),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        items[index].$2,
                        style: TextStyle(
                          fontSize: 13,
                          color: selected
                              ? AppColors.olive
                              : const Color(0xFF332F21),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
        ),
      ),
    );
  }
}
