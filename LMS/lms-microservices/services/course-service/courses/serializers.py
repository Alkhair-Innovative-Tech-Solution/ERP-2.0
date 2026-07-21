from rest_framework import serializers # type: ignore
from .models import Specialization

class SpecializationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialization
        fields = "__all__"
