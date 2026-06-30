import React from 'react';
import { Grid, Card, CardContent, Box, Skeleton } from '@mui/material';

/**
 * Skeleton placeholder for the printer card grid during loading.
 * Mimics the layout of real PrinterCard components.
 */
export default function PrinterCardSkeleton({ count = 8 }) {
  return (
    <Grid container spacing={0.5}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
          <Card sx={{ height: '100%', borderLeft: '4px solid #e0e0e0', p: '4px' }}>
            <CardContent sx={{ padding: '6px' }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                <Box flex={1}>
                  <Skeleton variant="text" width="70%" height={22} />
                  <Skeleton variant="text" width="50%" height={14} />
                  <Skeleton variant="text" width="40%" height={14} />
                </Box>
                <Skeleton variant="rounded" width={56} height={22} sx={{ borderRadius: '3px' }} />
              </Box>
              {/* Toner bars skeleton */}
              {[1, 2, 3, 4].map((bar) => (
                <Box key={bar} sx={{ mb: 0.5 }}>
                  <Box display="flex" justifyContent="space-between" mb={0.2}>
                    <Skeleton variant="text" width={30} height={12} />
                    <Skeleton variant="text" width={20} height={12} />
                  </Box>
                  <Skeleton variant="rounded" width="100%" height={5} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
