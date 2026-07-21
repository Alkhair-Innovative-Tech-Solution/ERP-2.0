from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    def list(self, request):
        qs = self.get_queryset()
        unread_count = qs.filter(is_read=False).count()
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return Response({
                'unread_count': unread_count,
                'results': serializer.data
            })
        serializer = self.get_serializer(qs, many=True)
        return Response({'unread_count': unread_count, 'results': serializer.data})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'message': 'All marked as read'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'message': 'Marked as read'})
